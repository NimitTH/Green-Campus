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

// Task 18 Part B fix round 2: the issued code belongs to one visit (Cache Components keep the page
// alive in a hidden <Activity>), and it is cleared when it runs out.
test("an issued code is gone after leaving and returning, and is cleared when it expires", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = `กิจกรรมจุดชั่งกลับมา ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-ws2-${suffix}`);
    student = await createConfirmedUser("student", `student-ws2-${suffix}`);
    await createJoinedCodeActivity(title, student.id);


    await signIn(page, teacher, "/staff");
    await page.getByRole("navigation", { name: "เมนูครู" }).getByRole("link", { name: /จุดชั่ง/ }).click();
    await page.getByLabel("กิจกรรม", { exact: true }).filter({ visible: true }).selectOption({ label: title });
    await page.getByRole("button", { name: /^ออกรหัสให้ / }).filter({ visible: true }).click();
    await expect(page.getByTestId("weigh-code").filter({ visible: true })).toHaveText(/^\d{6}$/);

    // leave and come back by client navigation: no stale code
    await page.getByRole("link", { name: /Green Campus/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff");
    await page.getByRole("navigation", { name: "เมนูครู" }).getByRole("link", { name: /จุดชั่ง/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/weigh-station");
    await expect(page.getByRole("button", { name: /^ออกรหัสให้ / }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByTestId("weigh-code")).toHaveCount(0);

    // a new code, then 30 minutes pass: the code is cleared and a notice says so
    await page.clock.install();
    await page.getByLabel("กิจกรรม", { exact: true }).filter({ visible: true }).selectOption({ label: title });
    await page.getByRole("button", { name: /^ออกรหัสให้ / }).filter({ visible: true }).click();
    await expect(page.getByTestId("weigh-code").filter({ visible: true })).toHaveText(/^\d{6}$/);
    await page.clock.fastForward("30:05");
    await expect(page.getByTestId("weigh-code")).toHaveCount(0);
    await expect(page.getByTestId("weigh-code-expired").filter({ visible: true })).toContainText("หมดอายุแล้ว");
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});
