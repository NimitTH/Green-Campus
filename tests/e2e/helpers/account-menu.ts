import { expect, type Page } from "@playwright/test";

/**
 * Open the header account menu ("เมนูบัญชี"). A click that lands before hydration does nothing, so retry the
 * click until aria-expanded is "true". Never clicks an already open button.
 */
export async function openAccountMenu(page: Page): Promise<void> {
  const button = page.getByRole("banner").getByRole("button", { name: "เมนูบัญชี" });
  await expect(async () => {
    if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
