import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { createConfirmedUser, deleteUsers, type TestUser } from "./helpers/supabase-admin";

// Round 6 (old-site features 5): website problem reports, student -> admins -> back to the student.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("a student reports, the admin resolves, the student is notified", async ({ browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const message = `ปุ่มตะกร้ากดไม่ได้ ${suffix}`;
  const note = `แก้แล้ว ลองใหม่ได้ ${suffix}`;
  let student: TestUser | undefined;
  let admin: TestUser | undefined;
  let teacher: TestUser | undefined;
  const studentCtx = await browser.newContext();
  const adminCtx = await browser.newContext();
  const teacherCtx = await browser.newContext();
  try {
    student = await createConfirmedUser("student", `student-pr-${suffix}`);
    admin = await createConfirmedUser("admin", `admin-pr-${suffix}`);
    teacher = await createConfirmedUser("teacher", `teacher-pr-${suffix}`);

    const sp = await studentCtx.newPage();
    await signIn(sp, student, "/report-problem");
    await sp.goto("/report-problem?from=%2Frewards");
    await expect(sp.getByTestId("report-page-url")).toHaveText("/rewards");
    // a blank message is refused before anything is sent
    await sp.getByRole("button", { name: "ส่งเรื่อง" }).click();
    await expect(sp.getByText("เขียนรายละเอียดปัญหาก่อนส่ง")).toBeVisible();
    await sp.getByLabel("เล่าปัญหาที่พบ").fill(message);
    await sp.getByRole("button", { name: "ส่งเรื่อง" }).click();
    await expect(sp.getByText("ส่งเรื่องแล้ว ขอบคุณที่แจ้ง ผู้ดูแลจะได้รับแจ้งเตือน")).toBeVisible();
    await expect(sp.getByLabel("เล่าปัญหาที่พบ")).toHaveValue("");

    const ap = await adminCtx.newPage();
    await signIn(ap, admin, "/staff/problem-reports");
    const item = ap.getByTestId("problem-report").filter({ hasText: message });
    await expect(item).toContainText("รอดำเนินการ");
    await expect(item.getByRole("link", { name: "/rewards" })).toHaveAttribute("href", "/rewards");
    await item.getByLabel("หมายเหตุถึงผู้แจ้ง (ไม่บังคับ)").fill(note);
    await item.getByRole("button", { name: "ทำเครื่องหมายว่าแก้แล้ว" }).click();
    await expect(item).toContainText("แก้แล้ว");
    await expect(item).toContainText(`หมายเหตุ: ${note}`);

    await sp.goto("/notifications");
    const notice = sp.getByText("ปัญหาที่แจ้งได้รับการแก้ไขแล้ว").first();
    await expect(notice).toBeVisible();
    await expect(sp.getByText(note)).toBeVisible();

    const tp = await teacherCtx.newPage();
    await signIn(tp, teacher, "/staff");
    await tp.goto("/staff/problem-reports");
    await expect(tp).toHaveURL((url) => url.pathname === "/staff");
  } finally {
    await studentCtx.close();
    await adminCtx.close();
    await teacherCtx.close();
    await deleteUsers([student, admin, teacher]);
  }
});

test("the footer link opens the report form; staff land on the staff version", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  let teacher: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-prf-${suffix}`);
    await signIn(page, student, "/activities");
    const link = page.getByRole("contentinfo").getByRole("link", { name: "แจ้งปัญหาการใช้งาน" });
    await expect(link).toBeVisible();
    if (testInfo.project.name === "mobile-chrome") {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await link.click();
    await expect(page).toHaveURL((url) => url.pathname === "/report-problem");
    await expect(page.getByTestId("report-page-url")).toHaveText("/activities");
    await page.context().clearCookies();

    teacher = await createConfirmedUser("teacher", `teacher-prf-${suffix}`);
    await signIn(page, teacher, "/staff");
    await page.goto("/report-problem?from=%2Fstaff%2Forders");
    await expect(page).toHaveURL((url) => url.pathname === "/staff/report-problem" && url.searchParams.get("from") === "/staff/orders");
    await expect(page.getByTestId("report-page-url")).toHaveText("/staff/orders");
  } finally {
    await deleteUsers([student, teacher]);
  }
});
