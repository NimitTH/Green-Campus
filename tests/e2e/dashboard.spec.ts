import { expect, test } from "@playwright/test";
import { estimateWaste } from "../../src/lib/units";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  seedSubmission,
  signedInClient,
  wasteCategoryId,
  wasteRates,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 11 (R53-R57): student dashboard and history.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("student with one approved waste result sees points, carbon, chart fallback and history", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมแดชบอร์ด ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-dash-${suffix}`);
    student = await createConfirmedUser("student", `student-dash-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, {
      type: "waste",
      unit_points: 0,
      requires_code: false,
    });
    const plastic = await wasteCategoryId("พลาสติก");
    const grams = 1550;
    const submissionId = await seedSubmission(student, activityId, PNG_1X1, [
      { waste_category_id: plastic, quantity: grams },
    ]);
    const teacherClient = await signedInClient(teacher);
    const { error } = await teacherClient.rpc("approve_submission", { p_submission_id: submissionId });
    expect(error).toBeNull();

    const expected = estimateWaste([{ grams, rates: await wasteRates("พลาสติก") }]);

    await signIn(page, student, "/dashboard");
    await expect(page.getByTestId("points")).toHaveText(String(expected.points));
    await expect(page.getByTestId("carbon")).toContainText(String(expected.carbonKg));
    await expect(page.getByTestId("waste-chart")).toBeVisible();
    await expect(page.getByTestId("waste-table")).toContainText("1.55 กก.");
    await expect(page.getByText("ยังไม่มีผลกิจกรรม")).toHaveCount(0);
    await expect(page.getByTestId("recent-submission").filter({ hasText: title })).toContainText("อนุมัติแล้ว");

    await page.getByRole("link", { name: "ดูทั้งหมด" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");
    const row = page.getByTestId("submission").filter({ hasText: title });
    await expect(row).toContainText("พลาสติก 1.55 กก.");
    await expect(row).toContainText(`${expected.points} แต้ม`);
    await expect(row).toContainText(`${expected.carbonKg} กก. CO2e`);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

test("a new student sees the empty state and no chart", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-dash-empty-${suffix}`);
    await signIn(page, student, "/dashboard");
    await expect(page.getByText("ยังไม่มีผลกิจกรรม")).toBeVisible();
    await expect(page.getByTestId("waste-chart")).toHaveCount(0);
    await expect(page.getByTestId("points")).toHaveText("0");
    await expect(page.getByTestId("carbon")).toContainText("0");
    await expect(page.getByRole("link", { name: "ดูกิจกรรม", exact: true })).toBeVisible();
  } finally {
    await deleteUsers([student]);
  }
});

test("staff on /dashboard get a link to /staff instead of student stats", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-dash-staff-${suffix}`);
    await signIn(page, teacher, "/dashboard");
    await expect(page.getByRole("link", { name: /ไปหน้าครูและผู้ดูแล/ })).toBeVisible();
    await expect(page.getByTestId("points")).toHaveCount(0);
    await expect(page.getByTestId("waste-chart")).toHaveCount(0);
  } finally {
    await deleteUsers([teacher]);
  }
});
