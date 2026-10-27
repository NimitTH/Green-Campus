import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  createConfirmedUser,
  createOrderFor,
  createRewardRow,
  deleteActivitiesByTitle,
  deleteRewardsByName,
  seedClosedApprovedActivity,
  deleteUsers,
  grantPoints,
  setFullName,
  type TestUser,
} from "./helpers/supabase-admin";

// Theme switcher (DESIGN 3.5): light / dark / system without a flash, persisted in localStorage.

declare global {
  interface Window {
    __themeAtDcl?: string;
    __themeLog?: { from: string | null; to: string | null }[];
  }
}

async function noSideScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function chooseTheme(page: Page, name: "สว่าง" | "มืด" | "ตามระบบ"): Promise<void> {
  await page.getByRole("button", { name: "ธีม" }).click();
  await page.getByRole("radio", { name }).click();
}

async function bodyBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test("theme choice survives a reload with no flash", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && /hydrat/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (/hydrat/i.test(e.message)) problems.push(e.message);
  });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      window.__themeAtDcl = document.documentElement.dataset.theme;
    });
    // Records every data-theme change on <html> from the very start of parsing, so a flash after
    // DOMContentLoaded (e.g. hydration clearing the attribute) is visible.
    window.__themeLog = [];
    const observe = () => {
      // One entry per batch of mutations (no paint can happen inside one task): the value before the batch and the
      // value after it. React's dev Strict Mode clears and restores the attribute within a single task, which is
      // not visible; a removal that survives the task is the flash this test exists to catch.
      new MutationObserver((records) => {
        const changes = records.filter((r) => r.attributeName === "data-theme");
        if (changes.length === 0) return;
        window.__themeLog!.push({ from: changes[0].oldValue, to: document.documentElement.getAttribute("data-theme") });
      }).observe(document.documentElement, { attributes: true, attributeOldValue: true });
    };
    if (document.documentElement) observe();
    else {
      const wait = new MutationObserver(() => {
        if (document.documentElement) {
          wait.disconnect();
          observe();
        }
      });
      wait.observe(document, { childList: true });
    }
  });
  await page.goto("/articles");
  await chooseTheme(page, "มืด");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__themeAtDcl)).toBe("dark");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  // after the head script set "dark" nothing may change the attribute again (no removal, no other value)
  const log = await page.evaluate(() => window.__themeLog);
  expect(log![0]).toEqual({ from: null, to: "dark" });
  expect(log!.slice(1).filter((e) => e.from !== "dark" || e.to !== "dark")).toEqual([]);
  await page.getByRole("button", { name: "ธีม" }).click();
  await expect(page.getByRole("radio", { name: "มืด" })).toHaveAttribute("aria-checked", "true");
  expect(problems).toEqual([]);
});

test("no choice follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/articles");
  const lightBg = await bodyBackground(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/articles");
  await expect.poll(() => bodyBackground(page)).not.toBe(lightBg);
  await chooseTheme(page, "สว่าง");
  await expect.poll(() => bodyBackground(page)).toBe(lightBg);
});

test("ตามระบบ clears the stored choice", async ({ page }) => {
  await page.goto("/articles");
  await chooseTheme(page, "มืด");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
  await chooseTheme(page, "ตามระบบ");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("compact popover closes with Esc and returns focus to the button", async ({ page }) => {
  await page.goto("/articles");
  const button = page.getByRole("button", { name: "ธีม" });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});

for (const scheme of ["light", "dark"] as const) {
  test(`public pages fit 360 px in the ${scheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ["/", "/articles"]) {
      await page.goto(path);
      await noSideScroll(page);
    }
  });
}

// App shell (DESIGN 4, "จุดอื่น"): the theme control sits in the student header and the staff sidebar.
test("student desktop header has the theme control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop layout only");
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-theme-${Date.now()}`);
    await signIn(page, student, "/dashboard");
    await expect(page.locator("header").getByRole("button", { name: "ธีม" })).toBeVisible();
  } finally {
    await deleteUsers([student]);
  }
});

test("staff sidebar has the theme control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop layout only");
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-theme-${Date.now()}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, teacher, "/staff");
    // the drawer copy is hidden at xl, so exactly the sidebar one is visible
    await expect(page.getByRole("radiogroup", { name: "ธีม" })).toBeVisible();
  } finally {
    await deleteUsers([teacher]);
  }
});

test("staff sidebar stays 208 px at md and holds the theme control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop layout only");
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-md-${Date.now()}`);
    await page.setViewportSize({ width: 768, height: 1024 });
    await signIn(page, teacher, "/staff");
    const sidebar = (await page.locator("aside").boundingBox())!;
    const group = page.getByRole("radiogroup", { name: "ธีม" });
    await expect(group).toBeVisible();
    const box = (await group.boundingBox())!;
    expect(sidebar.width).toBeLessThanOrEqual(208);
    expect(box.x).toBeGreaterThanOrEqual(sidebar.x);
    expect(box.x + box.width).toBeLessThanOrEqual(sidebar.x + sidebar.width);
    for (const radio of await group.getByRole("radio").all()) {
      expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await deleteUsers([teacher]);
  }
});

test("home page has a theme control that applies dark", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "ธีม" })).toBeVisible();
  await chooseTheme(page, "มืด");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("student can switch theme on ฉัน", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "mobile layout only");
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-profile-theme-${Date.now()}`);
    await signIn(page, student, "/profile");
    const group = page.getByRole("radiogroup", { name: "ธีม" });
    await expect(group).toBeVisible();
    await group.getByRole("radio", { name: "มืด" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally {
    await deleteUsers([student]);
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`staff orders fit 360 px in the ${scheme} theme`, async ({ page }) => {
    const stamp = `${scheme}-${Date.now()}`;
    const rewardNames = [`ของรางวัลชื่อยาวมากสำหรับทดสอบ ${stamp} ก`, `ของรางวัลชื่อยาวมากสำหรับทดสอบ ${stamp} ข`];
    let teacher: TestUser | undefined;
    let student: TestUser | undefined;
    try {
      teacher = await createConfirmedUser("teacher", `teacher-orders-${stamp}`);
      student = await createConfirmedUser("student", `student-orders-${stamp}`);
      await setFullName(student.id, "นักเรียนชื่อยาวมากสำหรับทดสอบการล้นของแถวออเดอร์บนจอเล็ก");
      await grantPoints(student.id, 1000);
      for (const name of rewardNames) {
        const rewardId = await createRewardRow(name, 20, 5);
        await createOrderFor(student.id, rewardId, 2, 20);
      }
      await page.setViewportSize({ width: 360, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await signIn(page, teacher, "/staff/orders");
      await expect(page.getByRole("heading", { level: 1, name: "ออเดอร์" })).toBeVisible();
      await expect(page.getByTestId("staff-order").first()).toBeVisible();
      expect(await page.getByTestId("staff-order").count()).toBeGreaterThanOrEqual(2);
      await noSideScroll(page);
    } finally {
      await deleteUsers([student, teacher]);
      await deleteRewardsByName(rewardNames);
    }
  });
}

// Task 10 (Review Focus 5): the reports page renders real rows in both tables and still fits a phone.
for (const scheme of ["light", "dark"] as const) {
  test(`staff reports fit 360 px in the ${scheme} theme`, async ({ page }) => {
    const stamp = `${scheme}-${Date.now()}`;
    const title = `รายงานกิจกรรมชื่อยาวมากสำหรับทดสอบการล้นของตารางบนจอเล็ก ${stamp}`;
    const studentName = "นักเรียนชื่อยาวมากสำหรับทดสอบการล้นของตารางรายงานบนจอเล็ก";
    let teacher: TestUser | undefined;
    let student: TestUser | undefined;
    try {
      teacher = await createConfirmedUser("teacher", `teacher-rep360-${stamp}`);
      student = await createConfirmedUser("student", `student-rep360-${stamp}`);
      await setFullName(student.id, studentName);
      await seedClosedApprovedActivity(student, teacher, 50, title);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await signIn(page, teacher, "/staff/reports");
      await expect(page.getByRole("heading", { level: 1, name: "รายงาน" })).toBeVisible();
      await expect(page.getByTestId("report-activities")).toContainText(title);
      await expect(page.getByTestId("report-students")).toContainText(studentName);
      await noSideScroll(page);
    } finally {
      // activity first: its submissions point at the evidence files, which the user cascade would orphan
      await deleteActivitiesByTitle(title);
      await deleteUsers([student, teacher]);
    }
  });
}
