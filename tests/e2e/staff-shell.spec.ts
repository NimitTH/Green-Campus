import { expect, test } from "@playwright/test";
import { greetingFor } from "../../src/lib/greeting";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import { openStaffMenu } from "./helpers/staff-menu";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  createOrderFor,
  createRewardRow,
  deleteActivitiesByTitle,
  deleteRewardsByName,
  deleteUsers,
  seedSubmission,
  signedInClient,
  wasteCategoryId,
  type TestUser,
} from "./helpers/supabase-admin";

// Redesign 4 Task 8 (DESIGN-4 4.2, 4.3): the collapsible staff sidebar and the /staff home header and charts.
// Also run by `npm run test:e2e:prod` (same detection as playwright.config.ts).

const PROD = process.env.E2E_PROD === "1" || process.env.npm_lifecycle_event === "test:e2e:prod";

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("the staff sidebar collapses to icons, remembers it across a reload, and expands again", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar only (phones keep the drawer)");
  const suffix = uniqueSuffix(testInfo.project.name);
  let admin: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `admin-shell-${suffix}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, admin, "/staff");
    const side = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
    await expect(side).toBeVisible();
    const aside = page.locator("aside").filter({ has: side });
    const reviews = side.locator('a[href="/staff/reviews"]');
    // expanded: labels shown, no aria-label, an icon per link
    await expect(reviews).toHaveText("ตรวจผล");
    await expect(reviews).not.toHaveAttribute("aria-label", /./);
    await expect(reviews.locator("svg[aria-hidden=true]")).toHaveCount(1);
    await expect(side.getByText("ผู้ดูแลระบบ", { exact: true })).toBeVisible();

    const collapse = page.getByRole("button", { name: "ยุบเมนู", exact: true });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(collapse).toHaveAttribute("aria-controls", (await aside.getAttribute("id"))!);
    // a click before hydration does nothing: retry until the state flips
    const expand = page.getByRole("button", { name: "กางเมนู", exact: true });
    await expect(async () => {
      if (await collapse.isVisible()) await collapse.click();
      await expect(expand).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    const assertCollapsed = async () => {
      expect((await aside.boundingBox())!.width).toBeLessThanOrEqual(64);
      await expect(reviews).toHaveAttribute("aria-label", "ตรวจผล");
      await expect(side.getByRole("link", { name: "ตรวจผล", exact: true })).toBeVisible();
      await expect(side.getByRole("link", { name: "ผู้ใช้", exact: true })).toHaveAttribute("aria-label", "ผู้ใช้");
      // the group heading gives way to the rule (kept for screen readers only)
      await expect(side.getByText("ผู้ดูแลระบบ", { exact: true })).toHaveClass(/sr-only/);
      await expect(side.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
    };
    await assertCollapsed();
    const cookie = (await context.cookies()).find((c) => c.name === "staff-sidebar");
    expect(cookie?.value).toBe("collapsed");
    expect(cookie?.path).toBe("/staff");
    expect(cookie?.sameSite).toBe("Lax");
    await expect(page.locator("html")).toHaveAttribute("data-staff-sidebar", "collapsed");

    // a tooltip on hover (CSS, aria-hidden)
    const tip = reviews.locator("span[aria-hidden=true]");
    await expect(tip).toBeHidden();
    await reviews.hover();
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText("ตรวจผล");

    // reload: the server reads the cookie, the sidebar stays collapsed
    await page.reload();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await assertCollapsed();
    // client navigation keeps it collapsed
    await side.getByRole("link", { name: "ออเดอร์", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/orders");
    await expect(expand).toHaveAttribute("aria-expanded", "false");

    await expect(async () => {
      if (await expand.isVisible()) await expand.click();
      await expect(collapse).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(reviews).not.toHaveAttribute("aria-label", /./);
    await expect(reviews).toHaveText("ตรวจผล");
    expect((await aside.boundingBox())!.width).toBeGreaterThan(150);
    expect((await context.cookies()).find((c) => c.name === "staff-sidebar")).toBeUndefined();
    await expect(page.locator("html")).not.toHaveAttribute("data-staff-sidebar", /./);
    await page.reload();
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
  } finally {
    await deleteUsers([admin]);
  }
});

// Review I1 (DESIGN-4 4.2 "ไม่กระพริบ"): the sidebar in the static shell (the Suspense fallback, before the cookie-backed
// sidebar streams in) is already collapsed. The page runs with no app bundles and with React's inline "swap the streamed
// boundary in" scripts removed, so what is measured is exactly what the browser can paint first: server HTML + head scripts.
test("a collapsed sidebar is already 64px in the server shell, before streaming or hydration", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar only (phones keep the drawer)");
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-shell-${suffix}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, teacher, "/staff");
    const origin = new URL(page.url()).origin;
    await context.addCookies([{ name: "staff-sidebar", value: "collapsed", url: `${origin}/staff`, sameSite: "Lax" }]);

    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.route(
      (url) => url.pathname === "/staff",
      async (route) => {
        const response = await route.fetch();
        const html = (await response.text()).replace(/<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?\$R[A-Z]\((?:(?!<\/script>)[\s\S])*?<\/script>/g, "");
        await route.fulfill({ response, body: html });
      },
    );
    await page.goto("/staff");
    const asides = page.locator("aside").filter({ visible: true });
    await expect(asides).toHaveCount(1);
    // the shell: the expanded-state fallback markup (its toggle still says ยุบเมนู), so this is not the streamed sidebar
    await expect(asides.locator("button", { hasText: "ยุบเมนู" })).toHaveCount(1);
    expect((await asides.boundingBox())!.width).toBeLessThanOrEqual(64);

    // control: without the cookie the same shell stays expanded
    await context.clearCookies({ name: "staff-sidebar" });
    await page.goto("/staff");
    await expect(asides).toHaveCount(1);
    await expect(page.locator("html")).not.toHaveAttribute("data-staff-sidebar", /./);
    expect((await asides.boundingBox())!.width).toBeGreaterThan(150);
  } finally {
    await deleteUsers([teacher]);
  }
});

// Review I1 (task 11, ruling R12): the cookie has path /staff, so on a public page the pre-paint script never sets
// <html data-staff-sidebar>. Guard: a client navigation into /staff must never show the sidebar wider than 64px; every
// width it takes from the click on, sampled on each DOM mutation and each animation frame, stays at 64px. Today the
// router's prefetched App Shell (partialPrefetching: it includes cookies()) and the navigation response both carry the
// cookie-backed sidebar, so the expanded static shell is never committed (task-11-fix-report.md). Meaningful in prod.
test("a collapsed sidebar stays 64px when a staff user client-navigates into /staff", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar only (phones keep the drawer)");
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-softnav-${suffix}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, teacher, "/activities");
    const origin = new URL(page.url()).origin;
    await context.addCookies([{ name: "staff-sidebar", value: "collapsed", url: `${origin}/staff`, sameSite: "Lax" }]);
    // the cookie is not visible here (path /staff), so nothing on this page knows the sidebar is collapsed
    await expect(page.locator("html")).not.toHaveAttribute("data-staff-sidebar", /./);

    await page.evaluate(() => {
      const w = window as unknown as { __asideWidths: number[] };
      w.__asideWidths = [];
      const sample = () => {
        for (const a of document.querySelectorAll("aside")) {
          const width = a.getBoundingClientRect().width;
          if (width > 0) w.__asideWidths.push(Math.round(width));
        }
      };
      new MutationObserver(sample).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
      const frame = () => {
        sample();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.locator('a[href="/staff"]').filter({ hasText: "หน้าหลัก", visible: true }).first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff");
    // the cookie-backed sidebar has streamed in (and the page under it)
    await expect(page.locator('aside[data-collapsed="true"]:not([data-sidebar-shell])')).toBeVisible();
    await expect(page.getByTestId("staff-role")).toBeVisible();
    await expect(page.getByRole("button", { name: "กางเมนู", exact: true })).toHaveAttribute("aria-expanded", "false");
    // the sampler survived: this was a client navigation, not a document load
    const widths = await page.evaluate(() => (window as unknown as { __asideWidths?: number[] }).__asideWidths);
    expect(widths, "a client navigation (the sampler is still installed)").toBeDefined();
    expect(widths!.length).toBeGreaterThan(0);
    expect(Math.max(...widths!), `sidebar widths seen: ${[...new Set(widths)].join(", ")}`).toBeLessThanOrEqual(64);
  } finally {
    await deleteUsers([teacher]);
  }
});

// Review I2 (task 11): a server-passed client child that suspends on its route chunks must never flip a stateful client
// frame's own Suspense boundary (cec031d: after login the drawer closed itself when the /staff charts chunk landed).
// The race is inside the page (when the charts chunk registers vs when the login navigation commits), so delaying the
// network cannot pin it: the commit itself waits for that chunk, and holding chunks back only moves both sides together
// (task-11-fix-report.md). It hits about every other cold login, so this repeats the exact user path several times,
// each from a full page load with the HTTP cache off (routing on), and fails on the first round whose drawer closes.
// Prod only: dev chunks differ. RED with the panel <Suspense> in staff-nav.tsx removed.
const DRAWER_ROUNDS = 8;
test("the staff drawer stays open after login while the /staff route chunks land", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "the drawer is the phone menu");
  test.skip(!PROD, "production chunks only (npm run test:e2e:prod)");
  test.setTimeout(180_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-chunk-${suffix}`);
    // routing turns the HTTP cache off, so every round downloads the /staff chunks again
    await page.route("**/_next/static/chunks/**/*.js", async (route) => route.fulfill({ response: await route.fetch() }));
    const toggle = page.getByRole("button", { name: "เมนู", exact: true });
    const signOut = page.getByRole("navigation", { name: "เมนูผู้ดูแล" }).getByRole("button", { name: "ออกจากระบบ" });
    for (let round = 1; round <= DRAWER_ROUNDS; round++) {
      await page.goto("/login?next=%2Fstaff");
      await page.getByLabel("อีเมล", { exact: true }).fill(teacher.email);
      await page.getByLabel("รหัสผ่าน", { exact: true }).fill(teacher.password);
      await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/staff");
      // open the drawer as soon as the toggle works, before the charts have rendered
      await openStaffMenu(page);
      // the charts chunk has landed and rendered; give React time to retry whatever was waiting on it
      await expect(page.getByTestId("carbon-chart").locator(".recharts-responsive-container")).toBeVisible();
      await page.waitForTimeout(1_000);
      await expect(toggle, `round ${round}: the drawer is still open`).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
      await expect(signOut).toBeVisible({ timeout: 1_000 });
      await signOut.click({ timeout: 5_000 });
      await expect(page).toHaveURL((url) => url.pathname === "/login");
    }
  } finally {
    await deleteUsers([teacher]);
  }
});

test("/staff greets the teacher with a role badge before the name, and shows the two charts", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมกราฟครู ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-home-${suffix}`);
    student = await createConfirmedUser("student", `student-home-${suffix}`);
    // one approved waste result: school-wide waste grams and this month's carbon are above zero
    const activityId = await createJoinedCodeActivity(title, student.id, { type: "waste", unit_points: 0, requires_code: false });
    const submissionId = await seedSubmission(student, activityId, PNG_1X1, [
      { waste_category_id: await wasteCategoryId("พลาสติก"), quantity: 1200 },
    ]);
    const { error } = await (await signedInClient(teacher)).rpc("approve_submission", { p_submission_id: submissionId });
    expect(error).toBeNull();

    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
    });
    page.on("pageerror", (e) => problems.push(e.message));
    const before = greetingFor(new Date());
    await signIn(page, teacher, "/staff");
    const after = greetingFor(new Date());
    // the greeting is rendered on the server (page.clock cannot move it); the hour boundaries are unit tested
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText(new RegExp(`^(${before}|${after}) ทดสอบ teacher$`));

    const badge = page.getByTestId("staff-role");
    await expect(badge).toHaveText("ครู");
    await expect(page.getByTestId("staff-name")).toHaveText("ทดสอบ teacher");
    const badgeFirst = await badge.evaluate((b) => {
      const name = document.querySelector('[data-testid="staff-name"]')!;
      return Boolean(b.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(badgeFirst).toBe(true);
    await expect(page.getByText(teacher.email, { exact: true })).toBeVisible();

    await expect(page.getByTestId("stat-pending-reviews")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "carbon ที่ลดได้รายเดือน (กก. CO₂e)" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "ขยะแยกตามกลุ่ม (กก.)" })).toBeVisible();
    await expect(page.getByTestId("carbon-chart")).toBeVisible();
    await expect(page.getByTestId("waste-chart")).toBeVisible();
    // six months, the current Bangkok month last, in the screen-reader table
    const rows = page.getByTestId("carbon-table").locator("tbody tr");
    await expect(rows).toHaveCount(6);
    const thisMonth = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
    await expect(rows.last().locator("th")).toHaveText(thisMonth);
    await expect(page.getByTestId("waste-table")).toContainText("พลาสติก");
    await expect(page.getByTestId("carbon-chart").locator("path.recharts-rectangle").first()).toBeVisible();

    // the old menu cards are gone
    await expect(page.getByText("อนุมัติหรือปฏิเสธผลที่นักเรียนส่ง")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "เมนูครู" })).toHaveCount(0);
    expect(problems.filter((p) => /hydrat|did not match|server rendered/i.test(p))).toEqual([]);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

test("admins get the ผู้ดูแลระบบ badge on /staff", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let admin: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `admin-home-${suffix}`);
    await signIn(page, admin, "/staff");
    await expect(page.getByTestId("staff-role")).toHaveText("ผู้ดูแลระบบ");
    await expect(page.getByTestId("staff-name")).toHaveText("ทดสอบ admin");
  } finally {
    await deleteUsers([admin]);
  }
});

// a11y follow-ups O1: "ข้ามไปเนื้อหา" is the first tab stop and moves focus to the page content.
test("skip link is the first tab stop and moves focus to the content", async ({ page }, testInfo) => {
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `skip-${uniqueSuffix(testInfo.project.name)}`);
    await signIn(page, teacher, "/staff/students");
    // a fresh document load, so sequential focus starts at the top (signIn leaves focus on the login form)
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "ข้ามไปเนื้อหา" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-main-content]").filter({ visible: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("[data-main-content] :focus")).toHaveCount(1);
  } finally {
    await deleteUsers([teacher]);
  }
});

test("skip link is hidden for mouse users and unique after navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar navigation");
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `skip-nav-${uniqueSuffix(testInfo.project.name)}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, teacher, "/staff/students");
    const skip = page.getByRole("link", { name: "ข้ามไปเนื้อหา" });
    await expect(skip).toHaveCount(1);
    await expect(skip).not.toBeInViewport();
    const side = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
    for (const href of ["/staff/activities", "/staff/orders", "/staff/students"]) {
      await side.locator(`a[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator("[data-main-content]").filter({ visible: true })).toHaveCount(1);
      await expect(skip).toHaveCount(1);
    }
    // after client navigation the one link still targets the visible page's content
    await skip.focus();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-main-content]").filter({ visible: true })).toBeFocused();
    await expect(page.locator("[data-main-content]").filter({ visible: true }).getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("บัญชีนักเรียน");
  } finally {
    await deleteUsers([teacher]);
  }
});

// a11y follow-ups O4: the last small links reach 44px on phones (the activity-form checkboxes keep their 44px label row).
test("remaining links are at least 44px on mobile", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "touch targets: phone project only");
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมเป้ากด ${suffix}`;
  const rewardName = `รางวัลเป้ากด ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-44-${suffix}`);
    student = await createConfirmedUser("student", `student-44-${suffix}`);
    await createJoinedCodeActivity(title, student.id);
    const rewardId = await createRewardRow(rewardName, 5, 10);
    await createOrderFor(student.id, rewardId, 1, 5, rewardName);

    const atLeast44 = async (locator: ReturnType<typeof page.locator>, width = false) => {
      await expect(locator).toBeVisible();
      const box = (await locator.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      if (width) expect(box.width).toBeGreaterThanOrEqual(44);
    };

    await signIn(page, teacher, "/staff");
    await atLeast44(page.getByTestId("stat-open-activities").getByRole("link").first());
    // Review Focus 5: the desktop list layout is unchanged (saved for a human look, not compared)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: testInfo.outputPath("staff-home-1280.png"), fullPage: true });
    await page.setViewportSize(testInfo.project.use.viewport!);
    await page.goto("/staff/orders");
    await atLeast44(page.getByTestId("staff-order").first().locator('a[href^="/orders/"]').first());

    const ctx = await browser.newContext({ ...testInfo.project.use });
    const sp = await ctx.newPage();
    await signIn(sp, student, "/activities");
    await atLeast44(sp.locator("header").locator('a[href="/"]').first(), true);
    await atLeast44(sp.locator("footer").locator('a[href^="https://ghgreduction"]').filter({ visible: true }).first());
    await ctx.close();
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]); // first: its order references the reward
    await deleteRewardsByName([rewardName]);
  }
});

// Final review I1: moving between the staff and student layouts keeps the hidden layout mounted (<Activity>);
// the page must still have one skip target, and the skip link must focus the visible page's content.
test("skip link target stays unique across the staff and student layouts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop sidebar navigation");
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมข้ามเลย์เอาต์ ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `skip-x-${suffix}`);
    student = await createConfirmedUser("student", `skip-x-stu-${suffix}`);
    await createJoinedCodeActivity(title, student.id);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, teacher, "/staff/activities");
    await page.goto(`/staff/activities?q=${encodeURIComponent(title)}`);

    const skipTo = async (heading: string) => {
      // no duplicate skip-target id in the document, whichever layout is hidden
      expect(await page.locator('[id="main-content"]').count()).toBeLessThanOrEqual(1);
      // the hidden layout's copy of the link is display:none; focus the one a keyboard user can reach
      const focused = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).filter((a) => a.textContent === "ข้ามไปเนื้อหา");
        const link = links.find((a) => a.checkVisibility());
        link?.focus();
        return Boolean(link);
      });
      expect(focused).toBe(true);
      await page.keyboard.press("Enter");
      const active = page.locator(":focus");
      await expect(active).toBeVisible();
      await expect(active.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    };

    await page.getByRole("link", { name: `ดู ${title}`, exact: true }).click();
    await expect(page).toHaveURL(/\/activities\/[0-9a-f-]+$/);
    await skipTo(title);

    await page.goBack();
    await expect(page).toHaveURL(/\/staff\/activities/);
    await skipTo("จัดการกิจกรรม");
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

// Final review I2: the 44px rule is for phones; on a desktop the /staff list rows keep their text height.
test("desktop /staff open-activity links keep their text height", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop only");
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมเดสก์ท็อป ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    teacher = await createConfirmedUser("teacher", `desk-${suffix}`);
    student = await createConfirmedUser("student", `desk-stu-${suffix}`);
    await createJoinedCodeActivity(title, student.id);
    const page = await ctx.newPage();
    await signIn(page, teacher, "/staff");
    const link = page.getByTestId("stat-open-activities").getByRole("link").first();
    await expect(link).toBeVisible();
    expect((await link.boundingBox())!.height).toBeLessThan(30);
  } finally {
    await ctx.close();
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});
