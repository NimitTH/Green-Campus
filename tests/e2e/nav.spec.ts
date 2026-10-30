import { expect, test, type Page } from "@playwright/test";
import { openAccountMenu } from "./helpers/account-menu";
import { signIn } from "./helpers/auth";
import { openStaffMenu } from "./helpers/staff-menu";
import { createConfirmedUser, createJoinedCodeActivity, deleteActivitiesByTitle, deleteUsers, type TestUser } from "./helpers/supabase-admin";

// R142 (spec 9.2, 9.3) and DESIGN-3 3: the app navigation shell. Student: 4-item bottom nav on mobile, one-row
// centre nav in the shared header on desktop, the profile in the header account menu. Staff: left sidebar on
// desktop, drawer on mobile, admin items only for admins.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function noSideScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test("student on a 360 px phone: 4-item bottom nav, one tap to rewards, nothing hidden behind it", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมเมนูล่าง ${suffix}`;
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-nav-${suffix}`);
    // a new open activity notifies every student: the bottom nav must show that unread count
    await createJoinedCodeActivity(title, student.id, { requires_code: false });
    await page.setViewportSize({ width: 360, height: 640 });
    await signIn(page, student, "/dashboard");

    const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
    await expect(nav).toBeVisible();
    // viewport-fit=cover, so the safe-area padding of the nav takes effect on notched phones
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(4);
    await expect(links.nth(0)).toHaveAccessibleName("หน้าหลัก");
    await expect(links.nth(1)).toHaveAccessibleName("กิจกรรม");
    await expect(links.nth(2)).toHaveAccessibleName("รางวัล");
    await expect(links.nth(3)).toHaveAccessibleName("แจ้งเตือน ยังไม่อ่าน 1 รายการ");
    await expect(links.nth(0)).toHaveAttribute("aria-current", "page");
    // reuses the bell: only one notification link on the page (no second bell, no second subscription)
    await expect(page.getByRole("link", { name: /^แจ้งเตือน/ })).toHaveCount(1);

    // fixed to the bottom of the viewport, tap targets >= 44 px
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(Math.abs(navBox!.y + navBox!.height - 640)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 4; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await noSideScroll(page);

    // scrolled to the bottom, the end of the page content sits above the nav
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await page.evaluate(() => {
      // Next keeps the previous route mounted but hidden (display:none): measure the visible <main>.
      const main = [...document.querySelectorAll("main")].find((m) => m.getClientRects().length > 0)!;
      if (main.getBoundingClientRect().height < 200) return -1; // must be real page content
      const bottomNav = document.querySelector('nav[aria-label="เมนูหลัก"][data-bottom-nav]')!;
      return bottomNav.getBoundingClientRect().top - main.getBoundingClientRect().bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(0);
    const lastHistory = page.getByRole("link", { name: "ดูทั้งหมด" });
    await lastHistory.scrollIntoViewIfNeeded();
    await expect(lastHistory).toBeInViewport();

    // one tap from /dashboard to /rewards
    await links.nth(2).click();
    await expect(page).toHaveURL((url) => url.pathname === "/rewards");
    await expect(nav.getByRole("link", { name: "รางวัล" })).toHaveAttribute("aria-current", "page");
    // cart and orders stay reachable from the rewards hub
    await expect(page.getByRole("link", { name: /^ตะกร้า/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "ออเดอร์ของฉัน" })).toBeVisible();
    await noSideScroll(page);

    // อันดับ, ผลที่ส่ง, บทความ and sign out from the profile, reached through the header account menu
    await openAccountMenu(page);
    await page.getByRole("banner").getByRole("link", { name: "โปรไฟล์", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/profile");
    const more = page.getByRole("navigation", { name: "ทางลัดของฉัน" });
    await expect(more.getByRole("link", { name: /อันดับ/ })).toBeVisible();
    await expect(more.getByRole("link", { name: /ผลที่ส่ง/ })).toBeVisible();
    await expect(more.getByRole("link", { name: /บทความ/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([student]);
  }
});

test("student dashboard links to rewards and orders; desktop header nav is one row", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-nav-desk-${suffix}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, student, "/dashboard");
    const cards = page.getByRole("navigation", { name: "เมนูนักเรียน" });
    await expect(cards.getByRole("link", { name: /^รางวัล/ })).toBeVisible();
    await expect(cards.getByRole("link", { name: /^ออเดอร์/ })).toBeVisible();
    await expect(cards.getByRole("link", { name: /^อันดับ/ })).toBeVisible();
    await expect(cards.getByRole("link", { name: /^ผลที่ส่ง/ })).toBeVisible();

    for (const width of [1280, 768]) {
      await page.setViewportSize({ width, height: 800 });
      const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
      await expect(nav).toBeVisible();
      await expect(nav).not.toHaveAttribute("data-bottom-nav");
      await expect(nav.getByRole("link", { name: "หน้าหลัก" })).toHaveAttribute("aria-current", "page");
      // one row: every item shares the first item's top edge
      const tops = await nav.getByRole("link").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      expect(tops.length).toBeGreaterThanOrEqual(5);
      expect(new Set(tops).size).toBe(1);
      await noSideScroll(page);
    }
  } finally {
    await deleteUsers([student]);
  }
});

test("staff drawer on mobile lists admin items only for admins and closes after a tap", async ({ browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  let admin: TestUser | undefined;
  const context = await browser.newContext({ viewport: { width: 360, height: 760 }, locale: "th-TH", timezoneId: "Asia/Bangkok" });
  try {
    teacher = await createConfirmedUser("teacher", `teacher-nav-${suffix}`);
    admin = await createConfirmedUser("admin", `admin-nav-${suffix}`);
    const common = ["หน้าหลัก", "ตรวจผล", "กิจกรรม", "จุดชั่ง", "ออเดอร์", "ของรางวัล", "บทความ", "รายงาน", "โปรไฟล์", "แจ้งเตือน"];

    for (const user of [teacher, admin]) {
      const page = await context.newPage();
      await signIn(page, user, "/staff");
      const menu = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
      await expect(menu).toBeHidden();
      const toggle = page.getByRole("button", { name: "เมนู" });
      await expect(toggle).toBeVisible();
      // the menu content is streamed in; wait until it is there (hidden) before opening
      const panelId = await toggle.getAttribute("aria-controls");
      await expect(page.locator(`[id="${panelId}"] a[href="/staff/reports"]`)).toBeAttached();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await openStaffMenu(page);
      await expect(menu).toBeVisible();
      // focus moves into the panel (first link)
      await expect(menu.getByRole("link", { name: "หน้าหลัก", exact: true })).toBeFocused();
      for (const name of common) await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
      await expect(menu.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
      const adminItems = [menu.getByRole("link", { name: "ผู้ใช้", exact: true }), menu.getByRole("link", { name: "อัตรา", exact: true })];
      for (const item of adminItems) await expect(item).toHaveCount(user.role === "admin" ? 1 : 0);
      if (user.role === "teacher") {
        // not just hidden: no admin link anywhere in the DOM (the drawer and the sidebar copy included)
        await expect(page.locator('a[href="/staff/users"]')).toHaveCount(0);
        await expect(page.locator('a[href="/staff/rates"]')).toHaveCount(0);
      }
      await expect(menu.getByRole("link", { name: "หน้าหลัก", exact: true })).toHaveAttribute("aria-current", "page");
      // the bell stays in the header
      await expect(page.getByRole("banner").getByRole("link", { name: /^แจ้งเตือน (ไม่มีรายการใหม่|ยังไม่อ่าน)/ })).toBeVisible();
      await noSideScroll(page);

      // Escape closes it from anywhere and gives focus back to the toggle
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // focus outside the panel
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toBeFocused();

      // a link tap closes it
      await openStaffMenu(page);
      await menu.getByRole("link", { name: "ตรวจผล", exact: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/staff/reviews");
      await expect(menu).toBeHidden();

      // so does any navigation from outside the panel (pathname change)
      await openStaffMenu(page);
      await page.getByRole("link", { name: /Green Campus/ }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/staff");
      await expect(menu).toBeHidden();
      await page.close();
    }
  } finally {
    await context.close();
    await deleteUsers([teacher, admin]);
  }
});

test("staff sidebar on desktop; staff /profile and /notifications keep the staff chrome", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-nav-desk-${suffix}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, teacher, "/staff/orders");
    const side = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
    await expect(side).toBeVisible();
    await expect(page.getByRole("button", { name: "เมนู" })).toBeHidden();
    await expect(side.getByRole("link", { name: "ออเดอร์", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(side.getByRole("link", { name: "ผู้ใช้", exact: true })).toHaveCount(0);
    // hidden elements included: no admin link anywhere for a teacher
    await expect(page.locator('a[href="/staff/users"]')).toHaveCount(0);
    await expect(page.locator('a[href="/staff/rates"]')).toHaveCount(0);

    // the student-only pages send staff to the staff versions, inside the staff shell
    for (const [from, to, heading] of [
      ["/profile", "/staff/profile", "โปรไฟล์ของฉัน"],
      ["/notifications", "/staff/notifications", "แจ้งเตือน"],
    ] as const) {
      await page.goto(from);
      await expect(page).toHaveURL((url) => url.pathname === to);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(side).toBeVisible();
      await expect(page.getByRole("navigation", { name: "เมนูหลัก" })).toHaveCount(0);
    }
    await expect(side.getByRole("link", { name: "แจ้งเตือน", exact: true })).toHaveAttribute("aria-current", "page");
    await side.getByRole("link", { name: "โปรไฟล์", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/profile");
    await expect(page.getByTestId("profile-role")).toHaveText("ครู");
  } finally {
    await deleteUsers([teacher]);
  }
});

test("on a tablet the weigh station keeps its full width (no sidebar squeezing it)", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-nav-tab-${suffix}`);
    await page.setViewportSize({ width: 820, height: 1180 });
    await signIn(page, teacher, "/staff/weigh-station");
    await expect(page.getByRole("heading", { level: 1, name: /จุดชั่ง/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "เมนูผู้ดูแล" })).toBeHidden();
    await expect(page.getByRole("button", { name: "เมนู" })).toBeVisible();
    const main = await page.locator("main").filter({ visible: true }).boundingBox();
    expect(main!.width).toBeGreaterThanOrEqual(760);
    // other staff pages on the same tablet do get the sidebar
    await page.goto("/staff");
    await expect(page.getByRole("navigation", { name: "เมนูผู้ดูแล" })).toBeVisible();
    await expect(page.getByRole("link", { name: /รายงาน/ }).filter({ hasText: "ดาวน์โหลด CSV/PDF" })).toBeVisible();
  } finally {
    await deleteUsers([teacher]);
  }
});

// DESIGN-3 3: one session-aware header (and the footer) on every page outside /staff/**.

const MAIN_ITEMS = ["หน้าหลัก", "กิจกรรม", "ผลที่ส่ง", "รางวัล", "อันดับ", "บทความ"];

test("anonymous header on /: เข้าสู่ระบบ goes to /login, no student nav", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "เข้าสู่ระบบ", exact: true })).toHaveAttribute("href", "/login");
  await expect(banner.getByRole("link", { name: "สมัครสมาชิก" })).toHaveAttribute("href", "/register");
  await expect(banner.getByRole("button", { name: "ธีม" })).toBeVisible();
  await expect(page.locator('nav[aria-label="เมนูหลัก"]')).toHaveCount(0);
  await expect(banner.getByRole("button", { name: "เมนูบัญชี" })).toHaveCount(0);
});

test("student on /articles sees the six centre items, no ฉัน", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "the centre nav is md+ only");
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-centre-${suffix}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page, student, "/articles");
    const nav = page.getByRole("banner").getByRole("navigation", { name: "เมนูหลัก" });
    await expect(nav).toBeVisible();
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(6);
    for (let i = 0; i < MAIN_ITEMS.length; i++) await expect(links.nth(i)).toHaveAccessibleName(MAIN_ITEMS[i]);
    await expect(nav.getByRole("link", { name: "บทความ" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "ฉัน", exact: true })).toHaveCount(0);
    // the student bell sits in the header from md up
    await expect(page.getByRole("banner").getByRole("link", { name: /^แจ้งเตือน/ })).toBeVisible();
  } finally {
    await deleteUsers([student]);
  }
});

test("student account menu: name, email, โปรไฟล์; Escape closes it; sign out gives the signed-out header", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-menu-${suffix}`);
    await signIn(page, student, "/articles");
    const banner = page.getByRole("banner");
    const button = banner.getByRole("button", { name: "เมนูบัญชี" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await openAccountMenu(page);
    const panel = page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("ทดสอบ student");
    await expect(panel).toContainText(student.email);
    await expect(panel.getByRole("link", { name: "โปรไฟล์", exact: true })).toHaveAttribute("href", "/profile");
    await expect(panel.getByRole("link", { name: "หน้าผู้ดูแล" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();

    // a click outside closes it too
    await openAccountMenu(page);
    await page.getByRole("contentinfo").click({ position: { x: 2, y: 2 } });
    await expect(panel).toBeHidden();

    await openAccountMenu(page);
    await panel.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(page.getByRole("banner").getByRole("link", { name: "เข้าสู่ระบบ", exact: true })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "เมนูบัญชี" })).toHaveCount(0);
  } finally {
    await deleteUsers([student]);
  }
});

test("teacher on /: the staff account menu, no student nav and no bell", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-pub-${suffix}`);
    await signIn(page, teacher, "/staff");
    await page.goto("/");
    await openAccountMenu(page);
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "หน้าผู้ดูแล" })).toHaveAttribute("href", "/staff");
    await expect(banner.getByRole("link", { name: "โปรไฟล์", exact: true })).toHaveAttribute("href", "/staff/profile");
    await expect(page.locator('nav[aria-label="เมนูหลัก"]')).toHaveCount(0);
    await expect(banner.getByRole("link", { name: /^แจ้งเตือน/ })).toHaveCount(0);
    await banner.getByRole("link", { name: "หน้าผู้ดูแล" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff");
  } finally {
    await deleteUsers([teacher]);
  }
});

test("student: the logo goes to /, and the header stays at the top after scrolling", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-logo-${suffix}`);
    await signIn(page, student, "/activities");
    await page.getByRole("banner").getByRole("link", { name: "Green Campus" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/");

    for (const path of ["/dashboard", "/activities"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // make the page tall enough to scroll, whatever data it has
      await page.evaluate(() => {
        const filler = document.createElement("div");
        filler.style.height = "3000px";
        document.querySelector("footer")!.before(filler);
        window.scrollTo(0, 1500);
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
      const box = await page.getByRole("banner").boundingBox();
      expect(box, path).not.toBeNull();
      expect(Math.abs(box!.y), path).toBeLessThanOrEqual(1);
    }
  } finally {
    await deleteUsers([student]);
  }
});

test("the footer is on every page outside /staff", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let student: TestUser | undefined;
  let teacher: TestUser | undefined;
  const anon = await browser.newContext();
  try {
    const anonPage = await anon.newPage();
    for (const path of ["/", "/articles", "/login"]) {
      await anonPage.goto(path);
      await expect(anonPage.getByRole("contentinfo"), path).toBeVisible();
    }
    student = await createConfirmedUser("student", `student-foot-${suffix}`);
    await signIn(page, student, "/dashboard");
    for (const path of ["/dashboard", "/profile"]) {
      await page.goto(path);
      await expect(page.getByRole("contentinfo"), path).toBeVisible();
    }
    await page.context().clearCookies();
    teacher = await createConfirmedUser("teacher", `teacher-foot-${suffix}`);
    await signIn(page, teacher, "/staff");
    await page.goto("/staff");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(0);
    await expect(page.locator('nav[aria-label="เมนูหลัก"]')).toHaveCount(0);
  } finally {
    await anon.close();
    await deleteUsers([student, teacher]);
  }
});

test("login page: description, forgot link on the password label row, eye toggle, Google placeholder, link to register", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("เข้าสู่ระบบเพื่อร่วมกิจกรรม ส่งผล และสะสมแต้มแลกรางวัล").filter({ visible: true })).toBeVisible();

  const label = page.locator("label", { hasText: /^รหัสผ่าน$/ }).filter({ visible: true });
  const forgot = page.getByRole("link", { name: "ลืมรหัสผ่าน?" }).filter({ visible: true });
  const labelBox = await label.boundingBox();
  const forgotBox = await forgot.boundingBox();
  expect(labelBox && forgotBox).toBeTruthy();
  const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
  expect(Math.abs(mid(labelBox!) - mid(forgotBox!))).toBeLessThanOrEqual(4);

  const pw = page.getByLabel("รหัสผ่าน", { exact: true }).filter({ visible: true });
  await expect(pw).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "แสดงรหัสผ่าน" }).filter({ visible: true }).click();
  await expect(pw).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "ซ่อนรหัสผ่าน" }).filter({ visible: true }).click();
  await expect(pw).toHaveAttribute("type", "password");

  await expect(page.getByText("หรือ", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย Google" }).filter({ visible: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ยังไม่เปิดให้ใช้งาน" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await expect(page.getByText("ยังไม่มีบัญชี?").filter({ visible: true })).toBeVisible();
  await page.getByRole("link", { name: "สมัครสมาชิก", exact: true }).filter({ visible: true }).last().click();
  await expect(page).toHaveURL(/\/register$/);
});

test("register page: description, two eye toggles, Google placeholder, link back to login", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByText("สมัครสมาชิกเพื่อเริ่มสะสมแต้มจากกิจกรรมรักษ์โลก").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "แสดงรหัสผ่าน" }).filter({ visible: true })).toHaveCount(2);
  await expect(page.getByText("หรือ", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "สมัครสมาชิกด้วย Google" }).filter({ visible: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ยังไม่เปิดให้ใช้งาน" })).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);

  await expect(page.getByText("มีบัญชีแล้ว?").filter({ visible: true })).toBeVisible();
  await page.locator("main").getByRole("link", { name: "เข้าสู่ระบบ", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
