import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { accountStatus, createConfirmedUser, deleteUsers, setAccountStatus, type TestUser } from "./helpers/supabase-admin";

// DESIGN-4 6.4 (Task 16): enforcement of account_status. The staff command UI comes in Task 17; here the
// status row is set directly with the service role.

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
