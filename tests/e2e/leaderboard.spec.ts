import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { createConfirmedUser, deleteUsers, grantCarbon, setFullName, type TestUser } from "./helpers/supabase-admin";

// Plan Task 15 (R95-R98): leaderboard, dashboard rank card, public totals on the home page.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("student sees the month tab with their row highlighted, the all-time tab, and the rank on the dashboard", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-lb-${suffix}`);
    await grantCarbon(student.id, 123456.789);

    await signIn(page, student, "/dashboard");
    const card = page.getByRole("link", { name: /อันดับเดือนนี้ #\d+/ });
    await expect(card).toBeVisible();
    const rank = ((await card.textContent()) ?? "").match(/#(\d+)/)?.[1];
    expect(rank).toBeTruthy();

    await card.click();
    await expect(page).toHaveURL((url) => url.pathname === "/leaderboard");
    await expect(page.getByRole("link", { name: "เดือนนี้", exact: true })).toHaveAttribute("aria-current", "page");
    const me = page.getByTestId("lb-me");
    await expect(me).toHaveCount(1);
    await expect(me).toContainText("ทดสอบ student");
    await expect(me).toContainText("123,456.789");
    await expect(me.getByTestId("lb-rank")).toHaveText(rank!);

    await page.getByRole("link", { name: "ตลอดกาล", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/leaderboard" && url.searchParams.get("period") === "all");
    await expect(page.getByRole("link", { name: "ตลอดกาล", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("lb-me")).toContainText("123,456.789");

    // the leaderboard is in the desktop header nav; on a 360 px phone (R142 bottom nav has 5 fixed items) it is
    // reached from the dashboard hub and "ฉัน", and the page stays inside 360 px
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "อันดับ" })).toHaveAttribute("aria-current", "page");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "ฉัน" }).click();
    await page.getByRole("navigation", { name: "ทางลัดของฉัน" }).getByRole("link", { name: /^อันดับ/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/leaderboard");
    await expect(page.getByTestId("lb-me")).toContainText("123,456.789");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  } finally {
    await deleteUsers([student]);
  }
});

test("a student without carbon sees ยังไม่มีอันดับ on the dashboard and an own row of 0", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-lb0-${suffix}`);
    await signIn(page, student, "/dashboard");
    await expect(page.getByRole("link", { name: /ยังไม่มีอันดับ/ })).toBeVisible();
    await page.goto("/leaderboard");
    await expect(page.getByTestId("lb-me")).toContainText("ทดสอบ student");
  } finally {
    await deleteUsers([student]);
  }
});

test("staff can open the leaderboard and get no own-rank card on the dashboard", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-lb-${suffix}`);
    await signIn(page, teacher, "/leaderboard");
    await expect(page.getByRole("heading", { name: "อันดับคาร์บอน" })).toBeVisible();
    await expect(page.getByTestId("lb-me")).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /อันดับเดือนนี้/ })).toHaveCount(0);
  } finally {
    await deleteUsers([teacher]);
  }
});

test("signed out, / shows the three totals and no names", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const uniqueName = `นักเรียนลับ${suffix.replace(/[^a-z0-9]/gi, "")}`;
  let student: TestUser | undefined;
  try {
    // a student who is on the leaderboard: their name must still never reach the public home page
    student = await createConfirmedUser("student", `student-lbpub-${suffix}`);
    await setFullName(student.id, uniqueName);
    await grantCarbon(student.id, 98765.432);
    await page.goto("/");
    await expect(page.getByTestId("stat-carbon")).toBeVisible();
    await expect(page.getByTestId("stat-waste")).toBeVisible();
    await expect(page.getByTestId("stat-trees")).toBeVisible();
    await expect(page.getByTestId("stat-carbon")).toContainText("กก.");
    await expect(page.getByTestId("stat-trees")).toContainText("ต้น");
    // Redesign 2: the header and footer repeat these links; the page's own pair is the closing call to action.
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "สมัครสมาชิก", exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(uniqueName);
    await expect(page.locator("body")).not.toContainText(/ทดสอบ (student|teacher|admin)/);
  } finally {
    await deleteUsers([student]);
  }
});
