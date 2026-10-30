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

async function flipTheme(page: Page): Promise<void> {
  await page.getByRole("button", { name: "ธีม" }).click();
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
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/articles");
  await flipTheme(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__themeAtDcl)).toBe("dark");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  // after the head script set "dark" nothing may change the attribute again (no removal, no other value)
  const log = await page.evaluate(() => window.__themeLog);
  expect(log![0]).toEqual({ from: null, to: "dark" });
  expect(log!.slice(1).filter((e) => e.from !== "dark" || e.to !== "dark")).toEqual([]);
  await expect(page.getByRole("button", { name: "ธีม" })).toHaveAttribute("aria-pressed", "true");
  expect(problems).toEqual([]);
});

test("no choice follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/articles");
  const lightBg = await bodyBackground(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/articles");
  await expect.poll(() => bodyBackground(page)).not.toBe(lightBg);
  await flipTheme(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => bodyBackground(page)).toBe(lightBg);
});

test("icon toggle flips from system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/articles");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  await flipTheme(page);
  await expect(html).toHaveAttribute("data-theme", "dark");
  await flipTheme(page);
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
});

test("toggle still flips when localStorage throws", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await flipTheme(page);
  await expect(html).toHaveAttribute("data-theme", "dark");
  await flipTheme(page);
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("a theme change in another tab updates this tab", async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  await first.emulateMedia({ colorScheme: "light" });
  await second.emulateMedia({ colorScheme: "light" });
  await first.goto("/articles");
  await second.goto("/articles");
  await expect(second.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await flipTheme(first);
  await expect(first.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(second.getByRole("button", { name: "ธีม" })).toHaveAttribute("aria-pressed", "true");
});

test("icon toggle first press from a dark system goes light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/articles");
  await expect(page.getByRole("button", { name: "ธีม" })).toHaveAttribute("aria-pressed", "true");
  await flipTheme(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

for (const scheme of ["light", "dark"] as const) {
  test(`public pages fit 360 px in the ${scheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ["/", "/articles", "/login"]) {
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

// Redesign 3 (DESIGN-3 3.2): the header theme control is the only one (the profile page has none), so phones get it too.
test("student phone header has the theme control", async ({ page }, testInfo) => {
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-theme-phone-${testInfo.project.name}-${Date.now()}`);
    await page.setViewportSize({ width: 360, height: 760 });
    await signIn(page, student, "/dashboard");
    const button = page.getByRole("banner").getByRole("button", { name: "ธีม" });
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
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
    await expect(page.getByRole("button", { name: "ธีม" })).toBeVisible();
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
    const button = page.getByRole("button", { name: "ธีม" });
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(sidebar.width).toBeLessThanOrEqual(208);
    expect(box.x).toBeGreaterThanOrEqual(sidebar.x);
    expect(box.x + box.width).toBeLessThanOrEqual(sidebar.x + sidebar.width);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  } finally {
    await deleteUsers([teacher]);
  }
});

test("home page has a theme control that applies dark", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "ธีม" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await flipTheme(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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

// Review fix (DESIGN 1.3): /staff/orders and /staff/users both have a search box. After a client navigation the
// first page can stay alive (hidden <Activity>), so their label/input ids must not collide.
test("staff users search label binds to its own visible input after visiting orders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar only");
  let admin: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `admin-ids-${Date.now()}`);
    await signIn(page, admin, "/staff/orders");
    await expect(page.getByRole("heading", { level: 1, name: "ออเดอร์" })).toBeVisible();
    // visit users, back to orders and to users again: the earlier copies of both pages stay alive
    const sidebar = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
    for (const [link, heading] of [
      ["ผู้ใช้", "จัดการผู้ใช้"],
      ["ออเดอร์", "ออเดอร์"],
      ["ผู้ใช้", "จัดการผู้ใช้"],
    ]) {
      await sidebar.getByRole("link", { name: link, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
    // kept-alive pages must not share an id (a label would bind to the hidden copy)
    await expect(page.locator("input[name=q]:visible")).toHaveCount(1);
    const duplicates = await page.evaluate(() => {
      const seen = new Set<string>();
      const dup = new Set<string>();
      for (const el of document.querySelectorAll("[id]")) {
        if (seen.has(el.id)) dup.add(el.id);
        seen.add(el.id);
      }
      return [...dup];
    });
    expect(duplicates).toEqual([]);
    const search = page.getByLabel("ค้นหาชื่อ");
    await expect(search).toHaveCount(1);
    await expect(search).toBeVisible();
    await search.fill("ทดสอบ");
    await expect(page.locator('input[name="q"]:visible')).toHaveValue("ทดสอบ");
  } finally {
    await deleteUsers([admin]);
  }
});

// Review fix (DESIGN 3.4): reduced motion must stop the primary button's lift/press. Tailwind 4 compiles
// hover:-translate-y-px / active:translate-y-px to the separate CSS `translate` property, not `transform`.
test("reduced motion: primary button does not lift or press", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "hover needs a pointer");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const submit = page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true });
  await expect(submit).toBeVisible();
  const before = (await submit.boundingBox())!;
  await submit.hover();
  await page.waitForTimeout(300);
  const hovered = (await submit.boundingBox())!;
  expect(await submit.evaluate((el) => getComputedStyle(el).translate)).toMatch(/^(none|0px|0px 0px)$/);
  expect(hovered.y).toBe(before.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const pressed = (await submit.boundingBox())!;
  expect(await submit.evaluate((el) => getComputedStyle(el).translate)).toMatch(/^(none|0px|0px 0px)$/);
  expect(pressed.y).toBe(before.y);
  await page.mouse.up();
});

// Review fix (DESIGN 1.3): login and register are kept alive by <Activity> and link to each other, so their
// field ids must not collide (a label would bind to the hidden page's input).
test("login and register keep unique ids and labels bind to the visible input", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one project is enough");
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "เข้าสู่ระบบ" })).toBeVisible();
  for (const [link, heading] of [
    ["สมัครสมาชิก", "สมัครสมาชิก"],
    ["เข้าสู่ระบบ", "เข้าสู่ระบบ"],
    ["สมัครสมาชิก", "สมัครสมาชิก"],
  ]) {
    await page.getByRole("main").getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  const duplicates = await page.evaluate(() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const el of document.querySelectorAll("[id]")) {
      if (seen.has(el.id)) dup.add(el.id);
      seen.add(el.id);
    }
    return [...dup];
  });
  expect(duplicates).toEqual([]);
  // the hidden copy of the other page may still exist; only the visible one may match the label
  const email = page.getByLabel("อีเมล", { exact: true }).and(page.locator(":visible"));
  await expect(email).toHaveCount(1);
  await expect(email).toBeVisible();
  await email.fill("a@example.com");
  await expect(email).toHaveValue("a@example.com");
});

// Task 7: the student dashboard (tape-decorated stat card) fits a phone in both themes.
for (const scheme of ["light", "dark"] as const) {
  test(`student dashboard fits 360 px in the ${scheme} theme`, async ({ page }) => {
    let student: TestUser | undefined;
    try {
      student = await createConfirmedUser("student", `student-dash360-${scheme}-${Date.now()}`);
      await setFullName(student.id, "นักเรียนชื่อยาวมากสำหรับทดสอบการล้นของหน้าหลักบนจอเล็ก");
      await page.setViewportSize({ width: 360, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await signIn(page, student, "/dashboard");
      await expect(page.getByTestId("points")).toBeVisible();
      await noSideScroll(page);
    } finally {
      await deleteUsers([student]);
    }
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`staff home fits 360 px in the ${scheme} theme`, async ({ page }) => {
    let teacher: TestUser | undefined;
    try {
      teacher = await createConfirmedUser("teacher", `teacher-home360-${scheme}-${Date.now()}`);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await signIn(page, teacher, "/staff");
      await expect(page.getByRole("main")).toBeVisible();
      await noSideScroll(page);
    } finally {
      await deleteUsers([teacher]);
    }
  });
}
