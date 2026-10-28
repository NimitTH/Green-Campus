import { expect, test, type Page } from "@playwright/test";
import { withLongTitleOpenActivity } from "./helpers/supabase-admin";

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

// Redesign 2 Task 5: the notebook home page.

async function duplicateIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

test("hero CTA sends anonymous visitor to login with next", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "ดูกิจกรรมที่เปิดรับ →" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.search === "?next=%2Factivities");
});

test("sections render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /แยกขยะวันนี้/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "กิจกรรมที่เปิดรับอยู่" })).toBeVisible();
  for (const id of ["stat-carbon", "stat-waste", "stat-trees"]) await expect(page.getByTestId(id)).toBeVisible();
});

test("header sticky on home", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  const box = await page.locator("header").first().boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.y)).toBeLessThanOrEqual(1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`no horizontal scroll at 360 in the ${scheme} theme`, async ({ page }) => {
    // The card may not show (the feed is cached for minutes); when it does, it must wrap inside the column.
    await withLongTitleOpenActivity(async () => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 2, name: "กิจกรรมที่เปิดรับอยู่" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw).toBeLessThanOrEqual(cw);
    });
  });
}

test("reduced motion stops decorations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "กิจกรรมที่เปิดรับอยู่" })).toBeVisible();
  const r = await page.evaluate(() => {
    const deco = [...document.querySelectorAll("[data-deco]")];
    return {
      deco: deco.length,
      animating: deco.filter((el) => el.getAnimations({ subtree: true }).length > 0).length,
      highlight: [...document.querySelectorAll(".ink-highlight")].map((el) => el.getAnimations().length),
      leaves: [...document.querySelectorAll(".leaf-fall")].map((el) => getComputedStyle(el).display),
    };
  });
  expect(r.deco).toBeGreaterThan(0);
  expect(r.animating).toBe(0);
  expect(r.highlight).toEqual([0]);
  expect(r.leaves.length).toBeGreaterThan(0);
  expect(r.leaves.every((d) => d === "none")).toBe(true);
});

test("no duplicate ids across / -> /articles -> /login -> / (client navigation)", async ({ page }) => {
  await page.goto("/");
  expect(await duplicateIds(page), "/").toEqual([]);
  await page.getByRole("main").getByRole("link", { name: "บทความ", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/articles");
  expect(await duplicateIds(page), "/articles").toEqual([]);
  await page.getByRole("contentinfo").getByRole("link", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  expect(await duplicateIds(page), "/login").toEqual([]);
  await page.getByRole("banner").getByRole("link", { name: "Green Campus" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { level: 2, name: "กิจกรรมที่เปิดรับอยู่" })).toBeVisible();
  expect(await duplicateIds(page), "/ again").toEqual([]);
});
