import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { createActivityRow, createConfirmedUser, deleteActivitiesByTitle, deleteUsers, type TestUser } from "./helpers/supabase-admin";

// Redesign 4 Task 13 (DESIGN-4 5.3): while a page's data is pending, its <Suspense> fallback is the page-shaped
// skeleton (list / detail / dashboard), then the content replaces it. The data is fetched on the server, so the
// browser cannot delay the Supabase REST call; instead the client navigation's RSC request (the dynamic part, not
// the prefetch) is held back 1.5 s, which keeps the prefetched static shell, with its fallbacks, on screen.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function holdNavigationData(page: Page, ms = 1500): Promise<void> {
  await page.route(
    (url) => !url.pathname.startsWith("/_next/static"),
    async (route) => {
      const h = route.request().headers();
      if (h["rsc"] === "1" && !h["next-router-prefetch"]) await new Promise((r) => setTimeout(r, ms));
      await route.continue();
    },
  );
}

type NextWindow = { next: { router: { push(h: string): void; prefetch(h: string): void } } };

// Ruling R17 (re-review M3): prefetching exists only in production, so this spec runs in `test:e2e:prod` only (the
// dev config ignores it; in dev the shell showed only when the stream happened to split). Prefetch the target and
// wait for that response first, so the static shell with its fallbacks is in the router cache before the held
// navigation: then the skeleton shows for the whole hold, every time. The route tree (`/_tree`) arrives before the
// page segment (`…/__PAGE__`), and a Link in the viewport may have fetched the segment already, so wait until the
// page segment of the target has been seen at any point (trackPrefetchedPages records them from the start).
function trackPrefetchedPages(page: Page): Set<string> {
  const seen = new Set<string>();
  page.on("response", (res) => {
    const seg = res.request().headers()["next-router-segment-prefetch"];
    if (res.ok() && seg?.endsWith("/__PAGE__")) seen.add(new URL(res.url()).pathname);
  });
  return seen;
}

async function go(page: Page, seen: Set<string>, to: string): Promise<void> {
  const path = new URL(to, "http://localhost").pathname;
  await page.evaluate((t) => (window as unknown as NextWindow).next.router.prefetch(t), to);
  await expect.poll(() => seen.has(path), { message: `prefetched page segment of ${path}` }).toBe(true);
  await page.evaluate((t) => (window as unknown as NextWindow).next.router.push(t), to);
}

test("skeletons show the page's shape while the data is held back, then the content replaces them", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `สเกเลตัน ${suffix}`;
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-skel-${suffix}`);
    const id = await createActivityRow(title);
    const seen = trackPrefetchedPages(page);
    await signIn(page, teacher, "/activities");
    await holdNavigationData(page);

    await go(page, seen, "/rewards");
    await expect(page.locator('[data-skeleton="list"]').first()).toBeVisible();
    await expect(page.getByTestId("reward-card").first().or(page.getByText("ยังไม่มีของรางวัลที่เปิดให้แลก")).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-skeleton="list"]')).toHaveCount(0);

    await go(page, seen, `/activities/${id}`);
    await expect(page.locator('[data-skeleton="detail"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-skeleton="detail"]')).toHaveCount(0);

    await go(page, seen, "/dashboard");
    await expect(page.locator('[data-skeleton="dashboard"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-skeleton="dashboard"]')).toHaveCount(0);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher]);
  }
});
