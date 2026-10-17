import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  createConfirmedUser,
  deleteActivitiesByTitle,
  deleteUsers,
  type TestUser,
} from "./helpers/supabase-admin";
import { bangkokInputValue } from "./helpers/time";

// Plan Task 6 step 4: a teacher creates an open activity, a student sees it, joins,
// and the button becomes "เข้าร่วมแล้ว" (also after a reload).
test("teacher creates an open activity and a student joins it", async ({ page, context }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = `กิจกรรมทดสอบ ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-${suffix}`);
    student = await createConfirmedUser("student", `student-${suffix}`);

    // Teacher: create the activity.
    const tp = page;
    await signIn(tp, teacher, "/staff/activities/new");
    await tp.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(title);
    await tp.getByLabel("สถานที่ (ไม่บังคับ)", { exact: true }).fill("ลานกิจกรรม");
    await tp.getByLabel("วันเวลาเริ่ม", { exact: true }).fill(bangkokInputValue(-60));
    await tp.getByLabel("วันเวลาสิ้นสุด", { exact: true }).fill(bangkokInputValue(24 * 60));
    await tp.getByRole("radio", { name: "แต้มคงที่ต่อครั้ง" }).check();
    await tp.getByLabel("แต้มต่อครั้ง", { exact: true }).fill("10");
    await tp.getByLabel("สถานะ", { exact: true }).selectOption("open");
    await tp.getByRole("button", { name: "บันทึกกิจกรรม" }).click();
    await expect(tp).toHaveURL((url) => url.pathname === "/staff/activities");
    await expect(tp.getByRole("heading", { name: title })).toBeVisible();

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
