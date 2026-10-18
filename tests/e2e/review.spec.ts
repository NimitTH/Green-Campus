import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  listLedgerForSubmission,
  listSubmissions,
  seedSubmission,
  signedInClient,
  wasteCategoryId,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 9 (R41): a teacher reviews a student's result; the student sees the outcome.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("teacher approves a waste result into the ledger and the student sees อนุมัติแล้ว", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมตรวจผล ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-rev-${suffix}`);
    student = await createConfirmedUser("student", `student-rev-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, {
      type: "waste",
      unit_points: 0,
      requires_code: false,
    });
    const plastic = await wasteCategoryId("พลาสติก");
    const submissionId = await seedSubmission(student, activityId, PNG_1X1, [
      { waste_category_id: plastic, quantity: 1500 },
    ]);

    // teacher: /staff -> ตรวจผล -> queue -> detail
    await signIn(page, teacher, "/staff");
    await page.getByRole("link", { name: /ตรวจผล/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/reviews");
    const row = page.getByTestId("review-row").filter({ hasText: title });
    await expect(row).toContainText("รวม 1.5 กก.");
    await row.getByRole("link").click();
    await expect(page).toHaveURL((url) => url.pathname === `/staff/reviews/${submissionId}`);

    // the photo (signed URL) loads next to the numbers
    const photo = page.getByRole("img", { name: /รูปหลักฐาน/ });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.getByText("1 กก. 5 ขีด")).toBeVisible();
    await expect(page.getByText(/ประมาณการ: 15 แต้ม/)).toBeVisible();
    await expect(page.getByText("แต้มจริงคำนวณจากอัตรา ณ ตอนกดอนุมัติ", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/reviews");
    await expect(page.getByRole("status")).toContainText("อนุมัติผลเรียบร้อย");
    await expect(page.getByTestId("review-row").filter({ hasText: title })).toHaveCount(0);

    expect((await listSubmissions(student.id, activityId))[0].status).toBe("approved");
    const ledger = await listLedgerForSubmission(submissionId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ kind: "earn", points: 15, created_by: teacher.id });
    expect(Number(ledger[0].carbon_kg)).toBe(1.547);

    // reviewed: status and reviewer, no buttons
    await page.goto(`/staff/reviews/${submissionId}`);
    await expect(page.getByText(/อนุมัติโดย/)).toBeVisible();
    await expect(page.getByRole("button", { name: "อนุมัติ", exact: true })).toHaveCount(0);

    // student sees the outcome
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await signIn(studentPage, student, "/my-submissions");
    await expect(studentPage.getByTestId("submission").filter({ hasText: title })).toContainText("อนุมัติแล้ว");
    await studentContext.close();
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

test("teacher rejects with a required reason and the student sees the reason", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมไม่ผ่าน ${suffix}`;
  const reason = "รูปไม่ชัด ถ่ายให้เห็นตาชั่งแล้วส่งใหม่";
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-rej-${suffix}`);
    student = await createConfirmedUser("student", `student-rej-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, { requires_code: false });
    const submissionId = await seedSubmission(student, activityId, PNG_1X1);

    await signIn(page, teacher, "/staff/reviews");
    const row = page.getByTestId("review-row").filter({ hasText: title });
    await expect(row).toContainText("เข้าร่วม");
    await row.getByRole("link").click();
    await expect(page).toHaveURL((url) => url.pathname === `/staff/reviews/${submissionId}`);

    // the reason is required (client-side check, nothing is sent)
    const rejectButton = page.getByRole("button", { name: "ไม่ผ่าน", exact: true });
    await rejectButton.click();
    await expect(page.getByText("กรุณากรอกเหตุผลที่ไม่ผ่าน")).toBeVisible();
    expect((await listSubmissions(student.id, activityId))[0].status).toBe("pending");

    await page.getByLabel(/เหตุผลที่ไม่ผ่าน/).fill(reason);
    await rejectButton.click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/reviews");
    await expect(page.getByRole("status")).toContainText("บันทึกว่าไม่ผ่านเรียบร้อย");
    expect((await listSubmissions(student.id, activityId))[0].status).toBe("rejected");
    expect(await listLedgerForSubmission(submissionId)).toHaveLength(0);

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await signIn(studentPage, student, "/my-submissions");
    const studentRow = studentPage.getByTestId("submission").filter({ hasText: title });
    await expect(studentRow).toContainText("ไม่ผ่าน");
    await expect(studentRow).toContainText(`เหตุผล: ${reason}`);
    await studentContext.close();
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

// R34: the row lock (FOR UPDATE) lets exactly one of two concurrent reviews through.
test("two concurrent approvals write exactly one ledger row", async ({}, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมอนุมัติพร้อมกัน ${suffix}`;
  let teacher: TestUser | undefined;
  let admin: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-race-rev-${suffix}`);
    admin = await createConfirmedUser("admin", `admin-race-rev-${suffix}`);
    student = await createConfirmedUser("student", `student-race-rev-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, { requires_code: false });
    const submissionId = await seedSubmission(student, activityId, PNG_1X1);

    const [a, b] = await Promise.all([signedInClient(teacher), signedInClient(admin)]);
    const results = await Promise.all([
      a.rpc("approve_submission", { p_submission_id: submissionId }),
      b.rpc("approve_submission", { p_submission_id: submissionId }),
    ]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.find((r) => r.error !== null)?.error?.message).toBe("not_pending");
    expect(await listLedgerForSubmission(submissionId)).toHaveLength(1);
    expect((await listSubmissions(student.id, activityId))[0].status).toBe("approved");
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, admin, student]);
  }
});
