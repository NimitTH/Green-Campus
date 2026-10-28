import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  deleteArticlesByTitle,
  deleteUsers,
  findArticle,
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
    // Redesign 2: header, hero and footer all link to /articles; use the hero's.
    await page.getByRole("main").getByRole("link", { name: "บทความ", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/articles");
    await expect(page.getByRole("heading", { level: 1, name: "บทความความรู้" })).toBeVisible();
  } finally {
    await anon.close();
  }
});
