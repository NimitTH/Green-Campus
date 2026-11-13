import { expect, test, type Browser, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { staffMenu } from "./helpers/staff-menu";
import {
  accountEventsFor,
  accountStatus,
  createConfirmedUser,
  deleteUsers,
  grantCarbon,
  profileRole,
  setAccountStatus,
  setDemo,
  setDisplayName,
  setFullName,
  setRole,
  signedInClient,
  type TestUser,
} from "./helpers/supabase-admin";

// DESIGN-4 6.4 (Task 16): enforcement of account_status, with the status row set directly by the service role.
// DESIGN-4 6.1-6.2 (Task 17, tag @accounts): the staff pages /staff/students(/[id]) and their commands.

const SUSPENDED = "บัญชีนี้ถูกระงับ ติดต่อครูหรือผู้ดูแล";

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

test("a suspended student is signed out on the next page and cannot sign back in", async ({ page }, testInfo) => {
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `acct-susp-${uniqueSuffix(testInfo.project.name)}`);
    await signIn(page, student, "/dashboard");

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await setAccountStatus(student.id, { suspended_until: tomorrow, suspend_reason: "e2e" });

    await page.goto("/dashboard");
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("error") === "suspended");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(SUSPENDED);

    // The session is gone: a protected page now asks to sign in (no suspended message).
    await page.goto("/cart");
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/cart");

    // Signing in again is refused with the same message while the suspension lasts.
    await page.getByLabel("อีเมล", { exact: true }).fill(student.email);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(student.password);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(SUSPENDED);
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await page.goto("/dashboard");
    await expect(page).toHaveURL((url) => url.pathname === "/login");

    // Once lifted, the student signs in normally.
    await setAccountStatus(student.id, { suspended_until: null, suspend_reason: null });
    await signIn(page, student, "/dashboard");
  } finally {
    await deleteUsers([student]);
  }
});

test("a suspension until lifted ('infinity') also signs the student out", async ({ page }, testInfo) => {
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `acct-inf-${uniqueSuffix(testInfo.project.name)}`);
    await signIn(page, student, "/dashboard");
    await setAccountStatus(student.id, { suspended_until: "infinity", suspend_reason: "e2e" });
    await page.goto("/notifications");
    await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("error") === "suspended");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(SUSPENDED);
  } finally {
    await deleteUsers([student]);
  }
});

test("a cross-site GET of /auth/signout does not sign out an active user", async ({ page }, testInfo) => {
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `acct-csrf-${uniqueSuffix(testInfo.project.name)}`);
    await signIn(page, student, "/dashboard");
    await page.goto("/auth/signout?reason=suspended");
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await page.goto("/dashboard");
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard");
  } finally {
    await deleteUsers([student]);
  }
});

test("a pending password change sends every page to /change-password until a new password is set", async ({ page }, testInfo) => {
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `acct-pw-${uniqueSuffix(testInfo.project.name)}`);
    await signIn(page, student, "/dashboard");
    await setAccountStatus(student.id, { must_change_password: true });

    await page.goto("/rewards");
    await expect(page).toHaveURL((url) => url.pathname === "/change-password");
    await expect(page.getByRole("heading", { name: "ตั้งรหัสผ่านใหม่" })).toBeVisible();

    const fresh = `New-${Math.random().toString(36).slice(2, 10)}-pass`;
    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(fresh);
    await page.getByLabel("ยืนยันรหัสผ่าน", { exact: true }).fill(`${fresh}x`);
    await page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();
    await expect(page.getByText(/ไม่ตรงกัน/)).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === "/change-password");

    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(fresh);
    await page.getByLabel("ยืนยันรหัสผ่าน", { exact: true }).fill(fresh);
    await page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard");
    expect((await accountStatus(student.id))?.must_change_password).toBe(false);

    // Without the flag the page just sends the user on.
    await page.goto("/change-password");
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard");
  } finally {
    await deleteUsers([student]);
  }
});

// --- Task 17: /staff/students ------------------------------------------------------------------------------------

const PANELS_ALL = ["รีเซ็ตรหัสผ่าน", "ระงับบัญชี", "แก้ชื่อ", "ปรับแต้ม", "ลบบัญชี"];

async function panelTitles(page: Page): Promise<string[]> {
  const panels = page.getByTestId("account-panel");
  await expect(panels.first()).toBeVisible();
  return (await panels.getByRole("heading", { level: 2 }).allTextContents()).map((t) => t.trim());
}

/** A page on a fresh context (its own cookies); the caller closes the context. */
async function freshPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

async function loginForm(page: Page, email: string, password: string, next = "/dashboard"): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("อีเมล", { exact: true }).fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
}

test("@accounts the sidebar lists บัญชีนักเรียน; a teacher sees only reset and suspend, an admin sees all five panels", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `นักเรียนแผง ${suffix}`;
  let teacher: TestUser | undefined;
  let admin: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `acct-t-${suffix}`);
    admin = await createConfirmedUser("admin", `acct-a-${suffix}`);
    student = await createConfirmedUser("student", `acct-s-${suffix}`);
    await setFullName(student.id, name);

    await signIn(page, teacher, "/staff");
    await (await staffMenu(page)).getByRole("link", { name: "บัญชีนักเรียน", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/students");
    await expect(page.getByRole("heading", { level: 1, name: "บัญชีนักเรียน" })).toBeVisible();
    const search = page.getByRole("searchbox", { name: "ค้นหานักเรียน" });
    await search.fill(name);
    await search.press("Enter");
    const row = page.getByTestId("student-row").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(student.email);
    await expect(row.getByTestId("student-points")).toHaveText("0");
    await row.getByRole("link").click();
    await expect(page).toHaveURL((url) => url.pathname === `/staff/students/${student!.id}`);
    await expect(page.getByTestId("account-status")).toHaveText("ปกติ");
    expect(await panelTitles(page)).toEqual(["รีเซ็ตรหัสผ่าน", "ระงับบัญชี"]);
    await expect(page.getByRole("button", { name: "บันทึกการปรับแต้ม" })).toHaveCount(0);

    await page.context().clearCookies();
    await signIn(page, admin, `/staff/students/${student.id}`);
    expect(await panelTitles(page)).toEqual(PANELS_ALL);

    // a non-student id is not a student page (404)
    await page.goto(`/staff/students/${teacher.id}`);
    await expect(page.getByText("This page could not be found")).toBeVisible();
    await expect(page.getByTestId("account-panel")).toHaveCount(0);
  } finally {
    await deleteUsers([student, teacher, admin]);
  }
});

test("@accounts reset password: shown once, the student must set a new one, the temporary one stops working", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  const pages: Page[] = [];
  try {
    teacher = await createConfirmedUser("teacher", `acct-rt-${suffix}`);
    student = await createConfirmedUser("student", `acct-rs-${suffix}`);

    await signIn(page, teacher, `/staff/students/${student.id}`);
    await page.getByRole("button", { name: "รีเซ็ตรหัสผ่าน", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "ยืนยันรีเซ็ตรหัสผ่าน" }).click();
    const shown = dialog.getByTestId("temp-password");
    await expect(shown).toHaveText(/^[A-Za-z0-9]{10}$/);
    const temp = (await shown.textContent())!.trim();
    await expect(dialog).toContainText("ให้รหัสนี้กับนักเรียน รหัสจะแสดงครั้งเดียว");
    await expect(dialog.getByRole("button", { name: "คัดลอกรหัสผ่าน" })).toBeVisible();
    expect(page.url()).not.toContain(temp);
    await dialog.getByRole("button", { name: "เสร็จแล้ว" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("temp-password")).toHaveCount(0); // shown once: gone after closing
    await expect(page.getByTestId("account-status")).toContainText("ต้องเปลี่ยนรหัสผ่าน");
    await expect(page.getByTestId("account-event").first()).toHaveAttribute("data-action", "password_reset");

    // the student signs in with the temporary password and must choose a new one
    const sp = await freshPage(browser);
    pages.push(sp);
    await loginForm(sp, student.email, temp);
    await expect(sp).toHaveURL((url) => url.pathname === "/change-password");
    const fresh = `New-${Math.random().toString(36).slice(2, 10)}-pass`;
    await sp.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(fresh);
    await sp.getByLabel("ยืนยันรหัสผ่าน", { exact: true }).fill(fresh);
    await sp.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();
    await expect(sp).toHaveURL((url) => url.pathname === "/dashboard");
    expect((await accountStatus(student.id))?.must_change_password).toBe(false);

    // the temporary password no longer works; the new one does
    const other = await freshPage(browser);
    pages.push(other);
    await loginForm(other, student.email, temp);
    await expect(other.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(other).toHaveURL((url) => url.pathname === "/login");
    await signIn(other, { ...student, password: fresh }, "/dashboard");
  } finally {
    for (const p of pages) await p.context().close();
    await deleteUsers([student, teacher]);
  }
});

test("@accounts suspend 1 day signs the student out and hides them from the leaderboard; unsuspend lets them back", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const shownName = `ระงับ${suffix}`.slice(0, 50);
  const reason = `ทดสอบระงับ ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  let sp: Page | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `acct-st-${suffix}`);
    student = await createConfirmedUser("student", `acct-ss-${suffix}`);
    await setDisplayName(student.id, shownName);
    await grantCarbon(student.id, 98_765_432.1);

    sp = await freshPage(browser);
    await signIn(sp, student, "/dashboard");

    await signIn(page, teacher, "/leaderboard");
    await expect(page.getByText(shownName, { exact: true })).toBeVisible();

    await page.goto(`/staff/students/${student.id}`);
    const suspendForm = page.getByRole("form", { name: "ระงับบัญชี" });
    // a missing reason is caught before the database
    await suspendForm.getByRole("button", { name: "ระงับบัญชี", exact: true }).click();
    await expect(page.getByText("กรอกเหตุผลที่ระงับ")).toBeVisible();
    await suspendForm.getByLabel("1 วัน", { exact: true }).check();
    await suspendForm.getByLabel("เหตุผลที่ระงับ").fill(reason);
    await suspendForm.getByRole("button", { name: "ระงับบัญชี", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ระงับบัญชีแล้ว" })).toBeVisible();
    const status = page.getByTestId("account-status");
    await expect(status).toContainText("ถูกระงับถึง");
    await expect(status).toContainText(reason);
    await expect(page.getByTestId("account-event").first()).toHaveAttribute("data-action", "suspend");
    await expect(page.getByTestId("account-event").first()).toContainText(`1 วัน · ${reason}`);

    // the student's open session: the next navigation lands on /login with the message
    await sp.goto("/notifications");
    await expect(sp).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("error") === "suspended");
    await expect(sp.getByRole("main").getByRole("alert")).toHaveText(SUSPENDED);
    await loginForm(sp, student.email, student.password);
    await expect(sp.getByRole("main").getByRole("alert")).toHaveText(SUSPENDED);
    await expect(sp).toHaveURL((url) => url.pathname === "/login");

    // gone from the leaderboard while suspended
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "อันดับคาร์บอน" })).toBeVisible();
    await expect(page.getByText(shownName, { exact: true })).toHaveCount(0);

    // the list shows the badge; the status filter finds them
    await page.goto(`/staff/students?status=suspended&q=${encodeURIComponent(student.email)}`);
    await expect(page.getByTestId("student-row")).toHaveCount(1);
    await expect(page.getByTestId("student-row").getByTestId("student-status")).toContainText("ถูกระงับถึง");

    await page.goto(`/staff/students/${student.id}`);
    await page.getByRole("button", { name: "ยกเลิกระงับ", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ยกเลิกระงับแล้ว" })).toBeVisible();
    await expect(page.getByTestId("account-status")).toHaveText("ปกติ");
    await signIn(sp, student, "/dashboard");
  } finally {
    if (sp) await sp.context().close();
    await deleteUsers([student, teacher]);
  }
});

test("@accounts delete: a wrong name keeps the button off; the right name deletes; the event stays", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `นักเรียนลบ ${suffix}`;
  let admin: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `acct-da-${suffix}`);
    student = await createConfirmedUser("student", `acct-ds-${suffix}`);
    await setFullName(student.id, name);
    const studentId = student.id;

    await signIn(page, admin, `/staff/students/${studentId}`);
    await page.getByRole("button", { name: "ลบบัญชี", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "ลบบัญชีถาวร" });
    const field = dialog.getByLabel(/เพื่อยืนยัน/);
    await expect(confirm).toBeDisabled();
    await field.fill(`${name}x`);
    await expect(confirm).toBeDisabled();
    await field.fill(name.replace(" ", "  ")); // inner spacing differs
    await expect(confirm).toBeDisabled();
    await field.fill(`  ${name} `); // surrounding spaces are trimmed
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page).toHaveURL((url) => url.pathname === "/staff/students" && url.searchParams.get("deleted") === "1");
    await expect(page.getByRole("status").filter({ hasText: "ลบบัญชีแล้ว" })).toBeVisible();
    student = undefined; // gone

    // the event list (the function the detail page reads) still has the delete with the name
    const c = await signedInClient(admin);
    const { data, error } = await c.rpc("staff_list_account_events", { p_student: studentId, p_limit: 20 });
    expect(error).toBeNull();
    expect((data as { action: string; student_name: string }[])[0]).toMatchObject({ action: "delete", student_name: name });
    expect((await accountEventsFor(studentId))[0]).toMatchObject({ action: "delete", student_name: name });
    await page.goto(`/staff/students/${studentId}`);
    await expect(page.getByText("This page could not be found")).toBeVisible();
  } finally {
    await deleteUsers([student, admin]);
  }
});

test("@accounts a demo admin sees the demo notice on a real student, and the database refuses", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let admin: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `acct-demo-${suffix}`);
    student = await createConfirmedUser("student", `acct-real-${suffix}`);
    await setDemo(admin.id, true);

    await signIn(page, admin, `/staff/students/${student.id}`);
    await expect(page.getByText("บัญชีสาธิตจัดการได้เฉพาะนักเรียนสาธิต")).toBeVisible();
    await expect(page.getByTestId("account-panel")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "รีเซ็ตรหัสผ่าน", exact: true })).toHaveCount(0);

    const c = await signedInClient(admin);
    const { error } = await c.rpc("staff_suspend_student", { p_student: student.id, p_days: 1, p_reason: "demo" });
    expect(error?.message).toBe("demo_scope");
    expect(await accountStatus(student.id)).toBeNull();
  } finally {
    await deleteUsers([student, admin]);
  }
});

test("@accounts admin renames a student and adjusts points there", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const newName = `ชื่อใหม่ ${suffix}`.slice(0, 100);
  let admin: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `acct-ra-${suffix}`);
    student = await createConfirmedUser("student", `acct-rs2-${suffix}`);

    await signIn(page, admin, `/staff/students/${student.id}`);
    const rename = page.getByRole("form", { name: "แก้ชื่อ" });
    await rename.getByLabel("ชื่อ-นามสกุลจริง").fill(`  ${newName}  `);
    await rename.getByLabel("ชื่อที่แสดง (ไม่บังคับ)").fill("ชื่อเล่นใหม่");
    await rename.getByRole("button", { name: "บันทึกชื่อ" }).click();
    await expect(page.getByRole("status").filter({ hasText: "บันทึกชื่อแล้ว" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: newName })).toBeVisible();
    await expect(page.getByText("ชื่อที่แสดง: ชื่อเล่นใหม่")).toBeVisible();
    await expect(page.getByTestId("account-event").first()).toHaveAttribute("data-action", "rename");

    await page.getByLabel("แต้ม (ใส่ลบเพื่อหัก)").fill("7");
    await page.getByLabel("เหตุผล (นักเรียนจะเห็นข้อความนี้)").fill(`โบนัส ${suffix}`);
    await page.getByRole("button", { name: "บันทึกการปรับแต้ม" }).click();
    await expect(page.getByRole("status").filter({ hasText: "ปรับแต้มเรียบร้อยแล้ว" })).toBeVisible();
    await expect(page.getByTestId("detail-points")).toHaveText("7");
  } finally {
    await deleteUsers([student, admin]);
  }
});

test("@accounts a suspended student cannot be promoted; a promoted suspended account shows the hint", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `นักเรียนเลื่อน ${suffix}`;
  let admin: TestUser | undefined;
  let student: TestUser | undefined;
  try {
    admin = await createConfirmedUser("admin", `acct-pa-${suffix}`);
    student = await createConfirmedUser("student", `acct-ps-${suffix}`);
    await setFullName(student.id, name);
    await setAccountStatus(student.id, { suspended_until: "infinity", suspend_reason: "e2e" });

    await signIn(page, admin, `/staff/users/${student.id}`);
    // the adjust form moved to /staff/students/[id] (DESIGN-4 6.1); the user page links there
    await expect(page.getByRole("button", { name: "บันทึกการปรับแต้ม" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "จัดการบัญชีนักเรียน" })).toHaveAttribute("href", `/staff/students/${student.id}`);

    await page.getByLabel(`บทบาทของ ${name}`).selectOption("teacher");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.getByRole("button", { name: "ยืนยันเปลี่ยนบทบาท" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "ถูกระงับอยู่" })).toBeVisible();
    expect(await profileRole(student.id)).toBe("student");

    // a row from before the guard (promoted directly): the user page explains how to recover
    await setRole(student.id, "teacher");
    await page.reload();
    await expect(page.getByTestId("promoted-suspended")).toBeVisible();
  } finally {
    await deleteUsers([student, admin]);
  }
});

test("@accounts /staff/students has no horizontal scroll at 360 px", async ({ browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  const context = await browser.newContext({ viewport: { width: 360, height: 760 }, locale: "th-TH", timezoneId: "Asia/Bangkok" });
  try {
    teacher = await createConfirmedUser("teacher", `acct-w-${suffix}`);
    student = await createConfirmedUser("student", `acct-ws-${suffix}-with-a-rather-long-email-address`);
    await setAccountStatus(student.id, { suspended_until: "infinity", suspend_reason: "e2e", must_change_password: true });
    const page = await context.newPage();
    await signIn(page, teacher, "/staff/students");
    for (const path of [`/staff/students?q=${encodeURIComponent(student.email)}`, `/staff/students/${student.id}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: "บัญชีนักเรียน" })).toBeVisible();
      await expect(page.getByTestId("student-status").first()).toBeVisible();
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, path).toBeLessThanOrEqual(clientWidth);
    }
  } finally {
    await context.close();
    await deleteUsers([student, teacher]);
  }
});
