import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteArticlesByTitle,
  deleteUsers,
  findArticle,
  listSubmissions,
  type TestUser,
} from "./helpers/supabase-admin";
import { bangkokInputValue } from "./helpers/time";

// Task 18 Part B fix round 2: Cache Components keep visited routes alive in a hidden <Activity>, so a
// form the user comes back to must not be stuck busy or show the previous visit's values and errors.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const visibleLabel = (page: Page, text: string) => page.getByLabel(text, { exact: true }).filter({ visible: true });

test("a student submits a waste activity twice in a row; the form is fresh the second time", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมส่งสองครั้ง ${suffix}`;
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-twice-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, {
      type: "waste",
      unit_points: 0,
      requires_code: false,
      max_per_submission: 10_000,
    });
    await signIn(page, student, `/activities/${activityId}/submit`);

    for (const kg of ["1", "2"]) {
      const submit = page.getByRole("button", { name: "ส่งผล" }).filter({ visible: true });
      await expect(submit).toBeEnabled();
      await expect(visibleLabel(page, "พลาสติก กิโลกรัม")).toHaveValue("");
      await visibleLabel(page, "พลาสติก กิโลกรัม").fill(kg);
      await page.getByLabel("รูปหลักฐาน").filter({ visible: true }).setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: PNG_1X1 });
      await submit.click();
      await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");
      if (kg === "1") {
        await page.goBack();
        await expect(page).toHaveURL((url) => url.pathname === `/activities/${activityId}/submit`);
      }
    }
    await expect.poll(async () => (await listSubmissions(student!.id, activityId)).length).toBe(2);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([student]);
  }
});

test("staff create two activities in a row; the second form is fresh with the default type", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const titles = [`กิจกรรมแรก ${suffix}`, `กิจกรรมสอง ${suffix}`];
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-acttwice-${suffix}`);
    await signIn(page, teacher, "/staff/activities");

    // an abandoned attempt: another type, a failed save, then ยกเลิก (a client navigation that keeps
    // the page alive in <Activity>)
    await page.getByRole("link", { name: "สร้างกิจกรรม" }).click();
    await page.getByRole("radio", { name: "แต้มคงที่ต่อครั้ง" }).filter({ visible: true }).check();
    await visibleLabel(page, "ชื่อกิจกรรม").fill("ร่างที่ทิ้ง");
    await visibleLabel(page, "ชื่อกิจกรรม").fill("");
    await page.getByRole("button", { name: "บันทึกกิจกรรม" }).filter({ visible: true }).click();
    await expect(page.getByRole("alert").filter({ visible: true }).filter({ hasText: "กรุณาแก้ช่อง" })).toBeVisible();
    await page.getByRole("link", { name: "ยกเลิก", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/activities");

    for (const [i, title] of titles.entries()) {
      if (i === 1) {
        // the edit form of the first activity is alive too (same field names as the new form)
        await page.getByRole("link", { name: `แก้ไข ${titles[0]}` }).click();
        await expect(visibleLabel(page, "ชื่อกิจกรรม")).toHaveValue(titles[0]);
        await page.getByRole("link", { name: "ยกเลิก", exact: true }).filter({ visible: true }).click();
        await expect(page).toHaveURL((url) => url.pathname === "/staff/activities");
      }
      await page.getByRole("link", { name: "สร้างกิจกรรม" }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/staff/activities/new");
      // fresh: empty title, default type (waste) with the weigh code on, no errors
      await expect(visibleLabel(page, "ชื่อกิจกรรม")).toHaveValue("");
      await expect(page.getByRole("radio", { name: "ชั่งน้ำหนักขยะ" }).filter({ visible: true })).toBeChecked();
      await expect(visibleLabel(page, "ต้องใช้รหัสยืนยันจากจุดชั่งเมื่อส่งผล")).toBeChecked();
      await expect(page.getByRole("alert").filter({ visible: true }).filter({ hasText: "กรุณาแก้ช่อง" })).toHaveCount(0);

      // a failed save first (no title), so the next visit must also drop the error state
      await page.getByRole("button", { name: "บันทึกกิจกรรม" }).filter({ visible: true }).click();
      await expect(page.getByRole("alert").filter({ visible: true }).filter({ hasText: "กรุณาแก้ช่อง" })).toBeVisible();

      await visibleLabel(page, "ชื่อกิจกรรม").fill(title);
      await visibleLabel(page, "วันเวลาเริ่ม").fill(bangkokInputValue(-60));
      await visibleLabel(page, "วันเวลาสิ้นสุด").fill(bangkokInputValue(24 * 60));
      await page.getByRole("radio", { name: "แต้มคงที่ต่อครั้ง" }).filter({ visible: true }).check();
      await visibleLabel(page, "แต้มต่อครั้ง").fill("10");
      await page.getByRole("button", { name: "บันทึกกิจกรรม" }).filter({ visible: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/staff/activities");
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  } finally {
    for (const title of titles) await deleteActivitiesByTitle(title);
    await deleteUsers([teacher]);
  }
});

test("login after a failed attempt and a sign-out shows no stale error and an empty password", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-login-${suffix}`);
    await page.goto("/login?next=%2Fstaff");
    await visibleLabel(page, "อีเมล").fill(teacher.email);
    await visibleLabel(page, "รหัสผ่าน").fill("wrong-password-1");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).filter({ visible: true }).click();
    // (Next also renders a route announcer with role alert; match the error by its text)
    await expect(page.getByRole("alert").filter({ visible: true }).filter({ hasText: "ลืมรหัสผ่าน" })).toBeVisible();

    await visibleLabel(page, "รหัสผ่าน").fill(teacher.password);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).filter({ visible: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff");

    await page.getByRole("button", { name: "ออกจากระบบ" }).filter({ visible: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(visibleLabel(page, "รหัสผ่าน")).toHaveValue("");
    await expect(page.getByRole("alert").filter({ visible: true }).filter({ hasText: "ลืมรหัสผ่าน" })).toHaveCount(0);

    // and opening /login again by URL
    await page.goto("/login");
    await expect(visibleLabel(page, "รหัสผ่าน")).toHaveValue("");
    await expect(page.getByRole("alert").filter({ visible: true }).filter({ hasText: "ลืมรหัสผ่าน" })).toHaveCount(0);
  } finally {
    await deleteUsers([teacher]);
  }
});

test("staff edit the same article twice in a row on the same route without a false conflict", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name).toLowerCase();
  const slug = `e2e-twice-${suffix}`;
  const titles = [`บทความแก้สองครั้ง ${suffix}`, `แก้ครั้งที่หนึ่ง ${suffix}`, `แก้ครั้งที่สอง ${suffix}`];
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-arttwice-${suffix}`);
    await signIn(page, teacher, "/staff/articles/new");
    await visibleLabel(page, "ชื่อบทความ").fill(titles[0]);
    await page.getByLabel(/^slug/).filter({ visible: true }).fill(slug);
    await visibleLabel(page, "เนื้อหา").fill("เนื้อหา");
    await page.getByRole("button", { name: "บันทึกบทความ" }).filter({ visible: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/articles");

    for (let i = 1; i <= 2; i++) {
      await page.getByRole("link", { name: `แก้ไข ${titles[i - 1]}` }).click();
      await expect(visibleLabel(page, "ชื่อบทความ")).toHaveValue(titles[i - 1]);
      await visibleLabel(page, "ชื่อบทความ").fill(titles[i]);
      await page.getByRole("button", { name: "บันทึกบทความ" }).filter({ visible: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/staff/articles");
      await expect.poll(async () => (await findArticle(slug))?.title).toBe(titles[i]);
    }
  } finally {
    await deleteArticlesByTitle(titles);
    await deleteUsers([teacher]);
  }
});
