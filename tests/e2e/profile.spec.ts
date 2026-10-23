import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { openStaffMenu } from "./helpers/staff-menu";
import { createConfirmedUser, deleteUsers, profileNames, type TestUser } from "./helpers/supabase-admin";

// Plan Task 18 Part B (R123, R124): /profile edits full_name and display_name.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("a student changes the display name on /profile and sees it on the leaderboard", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const nick = `ฮีโร่ ${Math.random().toString(36).slice(2, 8)}`;
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-prof-${suffix}`);
    await signIn(page, student, "/dashboard");
    await page.getByRole("navigation", { name: "เมนูนักเรียน" }).getByRole("link", { name: /โปรไฟล์/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/profile");
    await page.goto("/activities");
    await page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "ฉัน" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/profile");
    await expect(page.getByTestId("profile-role")).toHaveText("นักเรียน");
    await expect(page.getByTestId("profile-email")).toHaveText(student.email);
    await expect(page.getByLabel("ชื่อ-นามสกุลจริง")).toHaveValue("ทดสอบ student");

    // the preview follows the profile_display_name rule
    const display = page.getByLabel(/^ชื่อที่แสดง/);
    await display.fill("   ");
    await expect(page.getByTestId("profile-preview")).toHaveText("ทดสอบ student");
    await display.fill(`  ${nick} `);
    await expect(page.getByTestId("profile-preview")).toHaveText(nick);
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByRole("status")).toHaveText("บันทึกแล้ว");
    await expect.poll(async () => (await profileNames(student!.id)).display_name).toBe(nick);

    await page.goto("/leaderboard");
    await expect(page.getByTestId("lb-me")).toContainText(nick);

    // a blank display name falls back to the full name (stored as null)
    await page.goto("/profile");
    await page.getByLabel(/^ชื่อที่แสดง/).fill("");
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByRole("status")).toHaveText("บันทึกแล้ว");
    await expect.poll(async () => (await profileNames(student!.id)).display_name).toBeNull();
    await page.goto("/leaderboard");
    await expect(page.getByTestId("lb-me")).toContainText("ทดสอบ student");
  } finally {
    await deleteUsers([student]);
  }
});

test("too-long names show Thai errors and nothing is saved", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-prof-long-${suffix}`);
    await signIn(page, student, "/profile");
    await page.getByLabel("ชื่อ-นามสกุลจริง").fill("ก".repeat(101));
    await page.getByLabel(/^ชื่อที่แสดง/).fill("ข".repeat(51));
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByText("ชื่อ-นามสกุลยาวได้ไม่เกิน 100 ตัวอักษร")).toBeVisible();
    await expect(page.getByText("ชื่อที่แสดงยาวได้ไม่เกิน 50 ตัวอักษร")).toBeVisible();
    await expect(page.getByLabel("ชื่อ-นามสกุลจริง")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("ชื่อ-นามสกุลจริง").fill(" \t ");
    await page.getByLabel(/^ชื่อที่แสดง/).fill("");
    await page.getByRole("button", { name: "บันทึกโปรไฟล์" }).click();
    await expect(page.getByText("กรอกชื่อ-นามสกุลจริง")).toBeVisible();

    expect(await profileNames(student.id)).toEqual({ full_name: "ทดสอบ student", display_name: "ทดสอบ student" });
  } finally {
    await deleteUsers([student]);
  }
});

test("staff opening /profile get the staff profile in the staff chrome, which fits 360 px and leads back to /staff", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-prof-${suffix}`);
    await signIn(page, teacher, "/staff");
    // R142 / M7: /profile sends staff to /staff/profile (staff shell, no student nav)
    await page.goto("/profile");
    await expect(page).toHaveURL((url) => url.pathname === "/staff/profile");
    await expect(page.getByTestId("profile-role")).toHaveText("ครู");
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByRole("navigation", { name: "เมนูหลัก" })).toHaveCount(0);
    await openStaffMenu(page);
    const nav = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
    await expect(nav.getByRole("link", { name: "โปรไฟล์", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "บทความ", exact: true })).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await nav.getByRole("link", { name: "หน้าหลัก", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff");
  } finally {
    await deleteUsers([teacher]);
  }
});

test("anonymous visitors of /profile are sent to sign in", async ({ browser }) => {
  const anon = await browser.newContext();
  try {
    const page = await anon.newPage();
    await page.goto("/profile");
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/profile");
  } finally {
    await anon.close();
  }
});
