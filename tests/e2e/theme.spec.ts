import { expect, test, type Page } from "@playwright/test";

// Theme switcher (DESIGN 3.5): light / dark / system without a flash, persisted in localStorage.

declare global {
  interface Window {
    __themeAtDcl?: string;
  }
}

async function noSideScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function chooseTheme(page: Page, name: "สว่าง" | "มืด" | "ตามระบบ"): Promise<void> {
  await page.getByRole("button", { name: "ธีม" }).click();
  await page.getByRole("radio", { name }).click();
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
  });
  await page.goto("/articles");
  await chooseTheme(page, "มืด");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__themeAtDcl)).toBe("dark");
  await page.getByRole("button", { name: "ธีม" }).click();
  await expect(page.getByRole("radio", { name: "มืด" })).toHaveAttribute("aria-checked", "true");
  expect(problems).toEqual([]);
});

test("no choice follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/articles");
  const lightBg = await bodyBackground(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/articles");
  await expect.poll(() => bodyBackground(page)).not.toBe(lightBg);
  await chooseTheme(page, "สว่าง");
  await expect.poll(() => bodyBackground(page)).toBe(lightBg);
});

test("ตามระบบ clears the stored choice", async ({ page }) => {
  await page.goto("/articles");
  await chooseTheme(page, "มืด");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
  await chooseTheme(page, "ตามระบบ");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("compact popover closes with Esc and returns focus to the button", async ({ page }) => {
  await page.goto("/articles");
  const button = page.getByRole("button", { name: "ธีม" });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});

for (const scheme of ["light", "dark"] as const) {
  test(`public pages fit 360 px in the ${scheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ["/", "/articles"]) {
      await page.goto(path);
      await noSideScroll(page);
    }
  });
}
