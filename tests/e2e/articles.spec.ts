import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  deleteArticlesById,
  deleteArticlesByTitle,
  deleteUsers,
  findArticle,
  seedPublishedArticles,
  setDisplayName,
  type SeededArticle,
  storageObjectExists,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 18 Part B (R122, R124): staff write articles; anonymous visitors read the published ones.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toLowerCase();
}

async function fillArticle(page: Page, fields: { title: string; slug: string; body: string }) {
  await page.getByLabel("ชื่อบทความ").filter({ visible: true }).fill(fields.title);
  await page.getByLabel(/^slug/).filter({ visible: true }).fill(fields.slug);
  await page.getByLabel("เนื้อหา").filter({ visible: true }).fill(fields.body);
}

test("a teacher writes and publishes an article; anonymous visitors see it, and it 404s once unpublished", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `บทความทดสอบ ${suffix}`;
  const dupTitle = `บทความซ้ำ ${suffix}`;
  const slug = `e2e-${suffix}`;
  let teacher: TestUser | undefined;
  const anon = await browser.newContext();
  try {
    teacher = await createConfirmedUser("teacher", `teacher-art-${suffix}`);
    await signIn(page, teacher, "/staff");
    await page.getByRole("navigation", { name: "เมนูครู" }).getByRole("link", { name: /บทความ/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/articles");
    await page.getByRole("link", { name: "เขียนบทความ" }).click();

    // a draft with a cover; the body has markup that must show as plain text
    await fillArticle(page, { title, slug, body: "ย่อหน้าแรก <b>ไม่หนา</b>\nบรรทัดที่สอง\n\nย่อหน้าที่สอง" });
    await page.getByLabel("รูปปก").filter({ visible: true }).setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByRole("button", { name: "บันทึกบทความ" }).filter({ visible: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/articles");
    const row = page.getByTestId("staff-article").filter({ hasText: title });
    await expect(row).toContainText("ฉบับร่าง");
    const stored = await findArticle(slug);
    expect(stored?.published).toBe(false);
    expect(stored?.cover_path).toMatch(new RegExp(`^${stored?.id}/[0-9a-f-]{36}\\.jpg$`));

    // a draft is not public
    const anonPage = await anon.newPage();
    expect((await anonPage.goto(`/articles/${slug}`))?.status()).toBe(404);
    await expect(anonPage.getByText("ไม่พบบทความนี้")).toBeVisible();

    // the same slug again is refused in Thai
    await page.getByRole("link", { name: "เขียนบทความ" }).click();
    await fillArticle(page, { title: dupTitle, slug, body: "ซ้ำ" });
    await page.getByRole("button", { name: "บันทึกบทความ" }).filter({ visible: true }).click();
    await expect(page.getByText("slug นี้ถูกใช้แล้ว")).toBeVisible();
    await page.getByRole("link", { name: "ยกเลิก", exact: true }).click();

    // publish from the list
    await row.getByRole("button", { name: `เผยแพร่ ${title}`, exact: true }).click();
    await expect(row).toContainText("เผยแพร่แล้ว");
    expect((await findArticle(slug))?.published).toBe(true);

    expect((await anonPage.goto(`/articles/${slug}`))?.status()).toBe(200);
    await expect(anonPage.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(anonPage).toHaveTitle(new RegExp(title));
    const paragraphs = anonPage.getByTestId("article-body").locator("p");
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.first()).toContainText("ย่อหน้าแรก <b>ไม่หนา</b>");
    await expect(anonPage.getByTestId("article-body").locator("b")).toHaveCount(0);
    await expect(anonPage.locator("article img")).toHaveAttribute("src", /\/storage\/v1\/object\/public\/article-images\//);

    await anonPage.goto("/articles");
    const card = anonPage.getByTestId("article-card").filter({ hasText: title });
    await expect(card).toContainText("ย่อหน้าแรก");
    await card.click();
    await expect(anonPage).toHaveURL((url) => url.pathname === `/articles/${slug}`);

    // teachers cannot delete (admin only)
    await page.getByRole("link", { name: `แก้ไข ${title}` }).click();
    await expect(page.getByLabel("ชื่อบทความ").filter({ visible: true })).toHaveValue(title);
    await expect(page.getByRole("heading", { name: "ลบบทความ" })).toHaveCount(0);
    await page.getByRole("link", { name: "ยกเลิก", exact: true }).click();

    // unpublish: gone for anonymous visitors again
    await row.getByRole("button", { name: `ยกเลิกเผยแพร่ ${title}`, exact: true }).click();
    await expect(row).toContainText("ฉบับร่าง");
    expect((await anonPage.goto(`/articles/${slug}`))?.status()).toBe(404);
    await expect(anonPage.getByText("ไม่พบบทความนี้")).toBeVisible();
    await anonPage.goto("/articles");
    await expect(anonPage.getByTestId("article-card").filter({ hasText: title })).toHaveCount(0);
  } finally {
    await anon.close();
    await deleteArticlesByTitle([title, dupTitle]);
    await deleteUsers([teacher]);
  }
});

test("a blank slug is generated; an admin deletes the article and its cover", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `บทความลบ ${suffix}`;
  let adminUser: TestUser | undefined;
  const anon = await browser.newContext();
  try {
    adminUser = await createConfirmedUser("admin", `admin-art-${suffix}`);
    await signIn(page, adminUser, "/staff/articles/new");
    await fillArticle(page, { title, slug: "", body: "เนื้อหาที่จะถูกลบ" });
    await page.getByLabel("รูปปก").filter({ visible: true }).setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByLabel(/^เผยแพร่/).filter({ visible: true }).check();
    await page.getByRole("button", { name: "บันทึกบทความ" }).filter({ visible: true }).click();
    const row = page.getByTestId("staff-article").filter({ hasText: title });
    await expect(row).toContainText("เผยแพร่แล้ว");
    const slug = await row.getAttribute("data-slug");
    expect(slug).toMatch(/^a-[0-9a-z]{8}$/);
    const stored = await findArticle(slug!);
    expect(stored?.cover_path).toBeTruthy();
    expect(await storageObjectExists("article-images", stored!.cover_path!)).toBe(true);

    const anonPage = await anon.newPage();
    await anonPage.goto(`/articles/${slug}`);
    await expect(anonPage.getByRole("heading", { level: 1, name: title })).toBeVisible();

    await row.getByRole("link", { name: `แก้ไข ${title}` }).click();
    await page.getByRole("button", { name: `ลบ ${title}` }).click();
    await page.getByRole("button", { name: "ยืนยันลบ" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/articles");
    await expect(page.getByTestId("staff-article").filter({ hasText: title })).toHaveCount(0);
    expect(await findArticle(slug!)).toBeNull();
    await expect.poll(() => storageObjectExists("article-images", stored!.cover_path!)).toBe(false);

    expect((await anonPage.goto(`/articles/${slug}`))?.status()).toBe(404);
    await expect(anonPage.getByText("ไม่พบบทความนี้")).toBeVisible();
  } finally {
    await anon.close();
    await deleteArticlesByTitle([title]);
    await deleteUsers([adminUser]);
  }
});

test("the public home links to /articles, which needs no sign-in", async ({ browser }) => {
  const anon = await browser.newContext();
  try {
    const page = await anon.newPage();
    await page.goto("/");
    // Redesign 3: the hero and the footer link to /articles (the public header no longer does); use the hero's.
    await page.getByRole("main").getByRole("link", { name: "บทความ", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/articles");
    await expect(page.getByRole("heading", { level: 1, name: "บทความความรู้" })).toBeVisible();
  } finally {
    await anon.close();
  }
});

// Redesign 3 Task 7 (DESIGN-3 5.1/5.2): search, sort, card/list view, 12 per page, bylines and the share link.
// 13 published articles under a unique prefix, created in 2001 so they never displace anyone else's page 1.
test.describe("article list: search, sort, view, pagination", () => {
  let prefix = "";
  let seeded: SeededArticle[] = [];
  let author: TestUser | undefined;

  test.beforeAll(async () => {
    const suffix = uniqueSuffix(test.info().project.name).replace(/[^a-z0-9]/g, "");
    prefix = `e2elist${suffix}`;
    author = await createConfirmedUser("teacher", `teacher-list-${suffix}`);
    await setDisplayName(author.id, "ครูทดสอบ");
    seeded = await seedPublishedArticles(prefix, prefix, 13, { authorId: author.id, cover: true });
  });

  test.afterAll(async () => {
    await deleteArticlesById(seeded.map((a) => a.id));
    await deleteUsers([author]);
  });

  const titles = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 });

  test("search through the toolbar, 12 per page, page 2 has the 13th", async ({ page }) => {
    await page.goto("/articles");
    await page.getByRole("searchbox", { name: "ค้นหาบทความ" }).fill(prefix);
    await page.getByRole("searchbox", { name: "ค้นหาบทความ" }).press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === prefix && !url.searchParams.has("page"));
    await expect(titles(page)).toHaveCount(12);
    await expect(titles(page).first()).toHaveText(`${prefix} 12`);
    const pager = page.getByRole("navigation", { name: "แบ่งหน้า" });
    await expect(pager.getByRole("link", { name: "หน้า 1" })).toHaveAttribute("aria-current", "page");
    await pager.getByRole("link", { name: "หน้าถัดไป" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2");
    await expect(titles(page)).toHaveCount(1);
    await expect(titles(page).first()).toHaveText(`${prefix} 00`);
    await expect(pager.getByRole("link", { name: "หน้า 2" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("โดย ครูทดสอบ")).toBeVisible();
  });

  test("sort old → new puts the oldest first and goes back to page 1", async ({ page }) => {
    await page.goto(`/articles?q=${prefix}&page=2`);
    await page.getByLabel("เรียง").selectOption("old");
    await expect(page).toHaveURL((url) => url.searchParams.get("sort") === "old" && !url.searchParams.has("page"));
    await expect(titles(page)).toHaveCount(12);
    await expect(titles(page).first()).toHaveText(`${prefix} 00`);
  });

  test("the list view keeps the results and marks the toggle", async ({ page }) => {
    await page.goto(`/articles?q=${prefix}`);
    await expect(page.getByRole("link", { name: "การ์ด", exact: true })).toHaveAttribute("aria-current", "true");
    await page.getByRole("link", { name: "รายการ", exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("view") === "list" && url.searchParams.get("q") === prefix);
    await expect(page.getByRole("link", { name: "รายการ", exact: true })).toHaveAttribute("aria-current", "true");
    await expect(titles(page)).toHaveCount(12);
    // rows: every title shares one column (same left edge), unlike the card grid
    const lefts = await titles(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
  });

  test("PostgREST metacharacters are searched literally: empty state, no error", async ({ page }) => {
    const res = await page.goto(`/articles?q=${encodeURIComponent('a,b"(%')}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText("ไม่พบบทความที่ตรงกับคำค้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "ล้างการค้นหา" })).toHaveAttribute("href", "/articles");
    await expect(page.getByRole("searchbox", { name: "ค้นหาบทความ" })).toHaveValue('a,b"(%');
    // and a literal % / _ in the prefix search still finds only exact text
    await page.goto(`/articles?q=${encodeURIComponent(`${prefix}%`)}`);
    await expect(page.getByText("ไม่พบบทความที่ตรงกับคำค้น")).toBeVisible();
  });

  test("page past the end shows the last page; junk params fall back to the defaults", async ({ page }) => {
    const res = await page.goto(`/articles?q=${prefix}&page=999`);
    expect(res?.status()).toBe(200);
    await expect(titles(page)).toHaveCount(1);
    await expect(titles(page).first()).toHaveText(`${prefix} 00`);
    await page.goto(`/articles?q=${prefix}&page=abc&sort=xyz&view=grid`);
    await expect(titles(page)).toHaveCount(12);
    await expect(titles(page).first()).toHaveText(`${prefix} 12`);
    await expect(page.getByRole("link", { name: "การ์ด", exact: true })).toHaveAttribute("aria-current", "true");
    await page.goto(`/articles?q=${prefix}&page=-3`);
    await expect(titles(page)).toHaveCount(12);
  });

  test("detail: cover above the title, byline with the author or -", async ({ page }) => {
    await page.goto(`/articles/${seeded[0].slug}`);
    const h1 = page.getByRole("heading", { level: 1, name: seeded[0].title });
    await expect(h1).toBeVisible();
    const coverFirst = await page.evaluate(() => {
      const img = document.querySelector("article img");
      const h = document.querySelector("article h1");
      return !!img && !!h && Boolean(img.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(coverFirst).toBe(true);
    await expect(page.getByText(/^โดย ครูทดสอบ · /)).toBeVisible();
    await page.goto(`/articles/${seeded[1].slug}`);
    await expect(page.getByText(/^โดย - · /)).toBeVisible();
  });

  test("copy link puts the page URL on the clipboard", async ({ page, context, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium" || browserName !== "chromium", "clipboard permissions: desktop chromium only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/articles/${seeded[1].slug}`);
    await page.getByRole("button", { name: "คัดลอกลิงก์" }).click();
    await expect(page.getByRole("status").filter({ hasText: "คัดลอกแล้ว" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    await expect(page.getByRole("status").filter({ hasText: "คัดลอกแล้ว" })).toHaveCount(0, { timeout: 4000 });
  });
});
