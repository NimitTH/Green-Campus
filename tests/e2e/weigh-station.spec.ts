import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 7: a teacher issues a weigh station code for a joined student and sees 6 digits.
test("teacher issues a weigh station code", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = `กิจกรรมจุดชั่ง ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-ws-${suffix}`);
    student = await createConfirmedUser("student", `student-ws-${suffix}`);
    await createJoinedCodeActivity(title, student.id);

    await signIn(page, teacher, "/staff/weigh-station");
    await page.getByLabel("กิจกรรม", { exact: true }).selectOption({ label: title });
    await page.getByRole("button", { name: /^ออกรหัสให้ / }).click();

    await expect(page.getByTestId("weigh-code")).toHaveText(/^\d{6}$/);
    await expect(page.getByRole("timer")).toContainText("หมดอายุใน");
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});
