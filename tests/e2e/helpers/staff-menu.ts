import { expect, type Page } from "@playwright/test";

/**
 * Open the staff drawer (phones). A click that lands before hydration does nothing, so retry the click
 * until aria-expanded is "true" (fix round 1, M4). Never clicks an already open toggle.
 */
export async function openStaffMenu(page: Page): Promise<void> {
  const toggle = page.getByRole("button", { name: "เมนู" });
  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
