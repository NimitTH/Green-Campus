import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Open the staff drawer (phones). A click that lands before hydration does nothing, so retry the click
 * until aria-expanded is "true" (fix round 1, M4). Never clicks an already open toggle.
 * exact: the desktop sidebar has its own "ยุบเมนู"/"กางเมนู" button (DESIGN-4 4.2).
 */
export async function openStaffMenu(page: Page): Promise<void> {
  const toggle = page.getByRole("button", { name: "เมนู", exact: true });
  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * The visible staff menu (DESIGN-4 4.3: /staff has no menu cards any more): the sidebar on wide screens,
 * the drawer, opened first, on phones.
 */
export async function staffMenu(page: Page): Promise<Locator> {
  const nav = page.getByRole("navigation", { name: "เมนูผู้ดูแล" });
  const toggle = page.getByRole("button", { name: "เมนู", exact: true });
  await expect(nav.or(toggle).first()).toBeVisible();
  if (await toggle.isVisible()) await openStaffMenu(page);
  await expect(nav).toBeVisible();
  return nav;
}
