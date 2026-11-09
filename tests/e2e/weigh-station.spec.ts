import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { staffMenu } from "./helpers/staff-menu";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  joinAs,
  setFullName,
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
    await (await staffMenu(page)).getByRole("link", { name: "จุดชั่ง", exact: true }).click();
    await page.getByLabel("กิจกรรม", { exact: true }).filter({ visible: true }).selectOption({ label: title });
    await page.getByRole("button", { name: /^ออกรหัสให้ / }).filter({ visible: true }).click();
    await expect(page.getByTestId("weigh-code").filter({ visible: true })).toHaveText(/^\d{6}$/);

    // leave and come back by client navigation: no stale code
    await page.getByRole("link", { name: /Green Campus/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff");
    await (await staffMenu(page)).getByRole("link", { name: "จุดชั่ง", exact: true }).click();
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

// Redesign 4 Task 9: 13 joined students are 12 + 1 per page, and sorting by name puts the "ก" student first.
test("weigh station pages 13 participants and sorts them by name", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = `กิจกรรมจุดชั่งหน้า ${suffix}`;
  let teacher: TestUser | undefined;
  let students: TestUser[] = [];
  try {
    teacher = await createConfirmedUser("teacher", `teacher-ws3-${suffix}`);
    students = await Promise.all(Array.from({ length: 13 }, (_, i) => createConfirmedUser("student", `student-ws3-${i}-${suffix}`)));
    // names: the last student to join is the only one starting with ก, the others start with ข
    await Promise.all(students.map((s, i) => setFullName(s.id, i === 12 ? `กอไก่ ${suffix}` : `ขนม ${String(i).padStart(2, "0")} ${suffix}`)));
    const activityId = await createJoinedCodeActivity(title, students[0].id);
    for (const s of students.slice(1)) await joinAs(s.id, activityId);

    await signIn(page, teacher, "/staff/weigh-station");
    await page.getByLabel("กิจกรรม", { exact: true }).selectOption({ label: title });
    const rows = page.getByRole("button", { name: /^ออกรหัสให้ / });
    await expect(rows).toHaveCount(12);
    await expect(page.getByText(/^เข้าร่วม /).first()).toBeVisible();
    // joined oldest first: the ก student joined last, so it is on page 2
    await expect(page.getByRole("button", { name: `ออกรหัสให้ กอไก่ ${suffix}` })).toHaveCount(0);
    await page.getByRole("button", { name: "หน้าถัดไป" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAccessibleName(`ออกรหัสให้ กอไก่ ${suffix}`);

    // by name, ก ... ฮ: back to page 1 with the ก student first
    await page.getByLabel("เรียงตาม", { exact: true }).selectOption("name");
    await expect(rows).toHaveCount(12);
    await expect(rows.first()).toHaveAccessibleName(`ออกรหัสให้ กอไก่ ${suffix}`);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, ...students]);
  }
});
