import { expect, type Page } from "@playwright/test";
import type { TestUser } from "./supabase-admin";

/** Sign in through the real login form and land on `next`. */
export async function signIn(page: Page, user: TestUser, next: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("อีเมล", { exact: true }).fill(user.email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}
