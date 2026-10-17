import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  createConfirmedUser,
  deleteActivitiesByTitle,
  deleteUsers,
  type TestUser,
} from "./helpers/supabase-admin";
import { bangkokInputValue } from "./helpers/time";

/** On /staff/activities/new: fill a "fixed" activity (started 1 h ago, ends in 1 day) and save. */
async function fillAndSaveActivity(page: Page, title: string, status: "open" | "draft"): Promise<void> {
  await page.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(title);
  await page.getByLabel("สถานที่ (ไม่บังคับ)", { exact: true }).fill("ลานกิจกรรม");
  await page.getByLabel("วันเวลาเริ่ม", { exact: true }).fill(bangkokInputValue(-60));
  await page.getByLabel("วันเวลาสิ้นสุด", { exact: true }).fill(bangkokInputValue(24 * 60));
  await page.getByRole("radio", { name: "แต้มคงที่ต่อครั้ง" }).check();
  await page.getByLabel("แต้มต่อครั้ง", { exact: true }).fill("10");
  await page.getByLabel("สถานะ", { exact: true }).selectOption(status);
  await page.getByRole("button", { name: "บันทึกกิจกรรม" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/staff/activities");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Plan Task 6 step 4: a teacher creates an open activity, a student sees it, joins,
// and the button becomes "เข้าร่วมแล้ว" (also after a reload).
test("teacher creates an open activity and a student joins it", async ({ page, context }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมทดสอบ ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-${suffix}`);
    student = await createConfirmedUser("student", `student-${suffix}`);

    // Teacher: create the activity.
    const tp = page;
    await signIn(tp, teacher, "/staff/activities/new");
    await fillAndSaveActivity(tp, title, "open");

    // Student: a fresh session (cookies cleared) in the same configured context.
    await context.clearCookies();
    const sp = page;
    await signIn(sp, student, "/activities");
    await sp.getByRole("link", { name: title }).click();
    await expect(sp.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await sp.getByRole("button", { name: "เข้าร่วมกิจกรรม" }).click();

    const joined = sp.getByRole("button", { name: "เข้าร่วมแล้ว" });
    await expect(joined).toBeVisible();
    await expect(joined).toBeDisabled();

    await sp.reload();
    await expect(sp.getByRole("button", { name: "เข้าร่วมแล้ว" })).toBeDisabled();
    await expect(sp.getByRole("button", { name: "เข้าร่วมกิจกรรม" })).toHaveCount(0);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

// Ruling R17: a teacher deletes an activity without submissions (two-step confirm).
test("teacher deletes an activity without submissions", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมลบทดสอบ ${suffix}`;
  let teacher: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-del-${suffix}`);
    await signIn(page, teacher, "/staff/activities/new");
    await fillAndSaveActivity(page, title, "draft");

    await page.getByRole("button", { name: `ลบ ${title}` }).click();
    const confirm = page.getByRole("group", { name: `ยืนยันการลบ ${title}` });
    await expect(confirm.getByText("ยืนยันลบกิจกรรมนี้? ผู้เข้าร่วมจะถูกลบด้วย")).toBeVisible();

    // Cancel keeps it.
    await confirm.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.getByRole("button", { name: `ลบ ${title}` }).click();
    await page
      .getByRole("group", { name: `ยืนยันการลบ ${title}` })
      .getByRole("button", { name: "ยืนยันลบ" })
      .click();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher]);
  }
});
