import { expect, test } from "@playwright/test";

// Redesign 2 Task 3: shared SiteHeader / SiteFooter on the public and auth shells.

test("header stays visible after scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 400 });
  await page.goto("/articles");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const filler = document.createElement("div");
    filler.style.height = "3000px";
    document.querySelector("header")!.parentElement!.appendChild(filler);
    window.scrollTo(0, 1000);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  const box = await page.locator("header").first().boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.y)).toBeLessThanOrEqual(1);
});

test("header fits 360px without side scroll and has the required links", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto("/articles");
  const nav = page.getByRole("navigation", { name: "เมนูสาธารณะ" });
  await expect(nav.getByRole("link", { name: "สมัครสมาชิก" })).toHaveAttribute("href", "/register");
  await expect(nav.getByRole("link", { name: "เข้าสู่ระบบ / หน้าของฉัน" })).toHaveAttribute("href", "/dashboard");
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});

test("no duplicate ids on /articles and /login", async ({ page }) => {
  for (const path of ["/articles", "/login"]) {
    await page.goto(path);
    const dupes = await page.evaluate(() => {
      const seen = new Map<string, number>();
      for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    expect(dupes, path).toEqual([]);
  }
});
