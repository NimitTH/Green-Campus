import { expect, test, type Page } from "@playwright/test";

// Sign in with Google (docs/superpowers/specs/2026-11-26-google-signin-design.md). Runs with NEXT_PUBLIC_GOOGLE_AUTH=on
// (playwright.config.ts). Real Google is never reached: the Supabase authorize request is intercepted.

async function captureAuthorize(page: Page): Promise<() => URL | null> {
  let captured: URL | null = null;
  await page.route("**/auth/v1/authorize**", async (route) => {
    captured = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<p>stub google</p>" });
  });
  return () => captured;
}

test("Google button goes to the Supabase Google authorize URL and keeps next", async ({ page, context }) => {
  const authorize = await captureAuthorize(page);
  await page.goto("/login?next=%2Frewards");
  await page.getByRole("button", { name: "เข้าสู่ระบบด้วย Google" }).filter({ visible: true }).click();
  await expect.poll(() => authorize()?.searchParams.get("provider") ?? null).toBe("google");
  expect(authorize()!.searchParams.get("redirect_to")).toMatch(/\/auth\/callback\/google$/);
  const cookie = (await context.cookies()).find((c) => c.name === "gc_oauth_next");
  expect(cookie && decodeURIComponent(cookie.value)).toBe("/rewards");
});

test("register page has the working Google button too", async ({ page }) => {
  const authorize = await captureAuthorize(page);
  await page.goto("/register");
  await page.getByRole("button", { name: "สมัครสมาชิกด้วย Google" }).filter({ visible: true }).click();
  await expect.poll(() => authorize()?.searchParams.get("provider") ?? null).toBe("google");
});

test("cancel at Google lands on the login page with the Google message", async ({ page }) => {
  await page.goto("/auth/callback/google?error=access_denied&error_description=cancelled");
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("error") === "google");
  await expect(page.getByText("เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง").filter({ visible: true })).toBeVisible();
});

test("a bad code also lands on the login page with the Google message", async ({ page }) => {
  await page.goto("/auth/callback/google?code=not-a-real-code");
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("error") === "google");
});
