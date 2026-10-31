import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createActivityRow,
  createConfirmedUser,
  deleteActivitiesByPrefix,
  deleteActivitiesByTitle,
  deleteUsers,
  findActivity,
  joinAs,
  seedActivities,
  setActivityCover,
  setDisplayName,
  storageObjectExists,
  updateActivity,
  type TestUser,
} from "./helpers/supabase-admin";
import { bangkokInputValue } from "./helpers/time";

/** On /staff/activities/new: fill a "fixed" activity (started 1 h ago, ends in 1 day) and save. */
async function fillAndSaveActivity(
  page: Page,
  title: string,
  status: "open" | "draft",
  extra: { cover?: boolean; details?: string } = {},
): Promise<void> {
  await page.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(title);
  if (extra.details !== undefined) await page.getByLabel("รายละเอียดกิจกรรม", { exact: true }).fill(extra.details);
  if (extra.cover) await page.getByLabel("ภาพปก", { exact: true }).setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG_1X1 });
  await page.getByLabel("สถานที่ (ไม่บังคับ)", { exact: true }).fill("ลานกิจกรรม");
  await page.getByLabel("วันเวลาเริ่ม", { exact: true }).fill(bangkokInputValue(-60));
  await page.getByLabel("วันเวลาสิ้นสุด", { exact: true }).fill(bangkokInputValue(24 * 60));
  await page.getByRole("radio", { name: "แต้มคงที่ต่อครั้ง" }).check();
  await page.getByLabel("แต้มต่อครั้ง", { exact: true }).fill("10");
  await page.getByLabel("สถานะ", { exact: true }).selectOption(status);
  await page.getByRole("button", { name: "บันทึกกิจกรรม" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/staff/activities");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Plan Task 6 step 4: a teacher creates an open activity, a student sees it, joins,
// and the button becomes "เข้าร่วมแล้ว" (also after a reload).
test("teacher creates an open activity and a student joins it", async ({ page, context }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมทดสอบ ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-${suffix}`);
    student = await createConfirmedUser("student", `student-${suffix}`);

    // Teacher: create the activity.
    const tp = page;
    await signIn(tp, teacher, "/staff/activities/new");
    await fillAndSaveActivity(tp, title, "open");

    // Student: a fresh session (cookies cleared) in the same configured context.
    await context.clearCookies();
    const sp = page;
    await signIn(sp, student, "/activities");
    await sp.getByRole("link", { name: title }).click();
    await expect(sp.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await sp.getByRole("button", { name: "เข้าร่วมกิจกรรม" }).click();

    const joined = sp.getByRole("button", { name: "เข้าร่วมแล้ว" });
    await expect(joined).toBeVisible();
    await expect(joined).toBeDisabled();

    await sp.reload();
    await expect(sp.getByRole("button", { name: "เข้าร่วมแล้ว" })).toBeDisabled();
    await expect(sp.getByRole("button", { name: "เข้าร่วมกิจกรรม" })).toHaveCount(0);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher, student]);
  }
});

// Ruling R17: a teacher deletes an activity without submissions (two-step confirm).
test("teacher deletes an activity without submissions", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมลบทดสอบ ${suffix}`;
  let teacher: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-del-${suffix}`);
    await signIn(page, teacher, "/staff/activities/new");
    await fillAndSaveActivity(page, title, "draft");

    await page.getByRole("button", { name: `ลบ ${title}` }).click();
    const confirm = page.getByRole("group", { name: `ยืนยันการลบ ${title}` });
    await expect(confirm.getByText("ยืนยันลบกิจกรรมนี้? ผู้เข้าร่วมจะถูกลบด้วย")).toBeVisible();

    // Cancel keeps it.
    await confirm.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.getByRole("button", { name: `ลบ ${title}` }).click();
    await page
      .getByRole("group", { name: `ยืนยันการลบ ${title}` })
      .getByRole("button", { name: "ยืนยันลบ" })
      .click();
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0);
  } finally {
    await deleteActivitiesByTitle(title);
    await deleteUsers([teacher]);
  }
});

// Redesign 3 Task 8 (DESIGN-3 6.1/6.3): the teacher adds a cover and details; the student sees the cover and the
// creator on the card, and on the detail page the cover above the title, the details paragraphs and the copy link.
test("teacher adds a cover and details; the student sees them on the card and the detail page", async ({ page, context }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมมีปก ${suffix}`;
  const teacherName = `ครูปก ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-cover-${suffix}`);
    student = await createConfirmedUser("student", `student-cover-${suffix}`);
    await setDisplayName(teacher.id, teacherName);

    await signIn(page, teacher, "/staff/activities/new");
    await expect(page.getByText("0 / 20,000")).toBeVisible();
    await fillAndSaveActivity(page, title, "open", { cover: true, details: "บรรทัดแรก\n\nย่อหน้าสอง" });
    const row = await findActivity(title);
    expect(row?.cover_path?.startsWith(`${row.id}/`)).toBe(true);
    expect(row?.cover_path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
    expect(row?.details).toBe("บรรทัดแรก\n\nย่อหน้าสอง");
    expect(await storageObjectExists("activity-images", row!.cover_path!)).toBe(true);

    await context.clearCookies();
    await signIn(page, student, "/activities");
    await page.goto(`/activities?q=${encodeURIComponent(suffix)}`);
    const card = page.getByRole("link", { name: title });
    await expect(card).toHaveCount(1);
    await expect(card.locator("img")).toHaveCount(1);
    await expect(card.getByText(`โดย ${teacherName}`)).toBeVisible();

    await card.click();
    const article = page.getByRole("article");
    await expect(article.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const coverFirst = await page.evaluate(() => {
      const img = document.querySelector("article img");
      const h = document.querySelector("article h1");
      return !!img && !!h && Boolean(img.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(coverFirst).toBe(true);
    await expect(article.getByText(`โดย ${teacherName} · `)).toBeVisible();
    const first = article.getByText("บรรทัดแรก", { exact: true });
    const second = article.getByText("ย่อหน้าสอง", { exact: true });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    expect(await first.evaluate((el) => el.tagName)).toBe("P");
    expect(await second.evaluate((el) => el.tagName)).toBe("P");
    await expect(page.getByRole("button", { name: "คัดลอกลิงก์" })).toBeVisible();
  } finally {
    await deleteActivitiesByPrefix(title);
    await deleteUsers([teacher, student]);
  }
});

// DESIGN-3 6.1: removing a cover on edit deletes the old object; deleting the activity deletes its cover.
test("teacher removes a cover on edit, then deletes the activity: the cover objects go too", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมลบปก ${suffix}`;
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-uncover-${suffix}`);
    const id = await createActivityRow(title, { status: "draft" });
    const first = await setActivityCover(id);

    await signIn(page, teacher, `/staff/activities/${id}/edit`);
    await expect(page.getByRole("img", { name: "รูปปกปัจจุบัน" })).toBeVisible();
    await page.getByLabel("ลบรูปปก").check();
    await page.getByRole("button", { name: "บันทึกกิจกรรม" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/activities");
    await expect.poll(async () => (await findActivity(title))?.cover_path ?? null).toBeNull();
    expect(await storageObjectExists("activity-images", first)).toBe(false);

    const second = await setActivityCover(id);
    await page.goto(`/staff/activities/${id}/edit`);
    await page.getByRole("button", { name: `ลบ ${title}` }).click();
    await page.getByRole("group", { name: `ยืนยันการลบ ${title}` }).getByRole("button", { name: "ยืนยันลบ" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/activities");
    await expect.poll(() => findActivity(title)).toBeNull();
    expect(await storageObjectExists("activity-images", second)).toBe(false);
  } finally {
    await deleteActivitiesByPrefix(title);
    await deleteUsers([teacher]);
  }
});

// DESIGN-3 6.2: one list (open + joined), search, sort, card/list view, 12 per page. 13 open activities under a
// unique prefix, created in 2001 so they never displace anyone else's page 1. The visibility rows use a second
// prefix so they never count in the paging assertions.
test.describe("activity list: search, sort, view, pagination, visibility", () => {
  let prefix = "";
  let visPrefix = "";
  let student: TestUser | undefined;

  test.beforeAll(async () => {
    const suffix = uniqueSuffix(test.info().project.name).replace(/[^a-z0-9]/g, "");
    prefix = `e2eact${suffix}`;
    visPrefix = `e2evis${suffix}`;
    student = await createConfirmedUser("student", `student-actlist-${suffix}`);
    const ids = await seedActivities(prefix, 13);
    await joinAs(student.id, ids[5]);
    // a closed activity the student joined (joined while open), and a closed one the student never joined
    const [joinedClosed] = await seedActivities(`${visPrefix} joined`, 1);
    await joinAs(student.id, joinedClosed);
    await updateActivity(joinedClosed, { status: "closed" });
    await seedActivities(`${visPrefix} other`, 1, { status: "closed" });
  });

  test.afterAll(async () => {
    await deleteActivitiesByPrefix(prefix);
    await deleteActivitiesByPrefix(visPrefix);
    await deleteUsers([student]);
  });

  const items = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 });

  test("search, 12 per page, page 2 has the 13th; a joined one shows เข้าร่วมแล้ว", async ({ page }) => {
    await signIn(page, student!, "/activities");
    await page.getByRole("searchbox", { name: "ค้นหากิจกรรม" }).fill(prefix);
    await page.getByRole("searchbox", { name: "ค้นหากิจกรรม" }).press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === prefix && !url.searchParams.has("page"));
    await expect(items(page)).toHaveCount(12);
    await expect(items(page).first()).toHaveText(`${prefix} 12`);
    const pager = page.getByRole("navigation", { name: "แบ่งหน้า" });
    await pager.getByRole("link", { name: "หน้าถัดไป" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("page") === "2");
    await expect(items(page)).toHaveCount(1);
    await expect(items(page).first()).toHaveText(`${prefix} 00`);
    await page.goto(`/activities?q=${encodeURIComponent(`${prefix} 05`)}`);
    await expect(page.getByRole("link", { name: `${prefix} 05` })).toContainText("เข้าร่วมแล้ว");
    await page.goto(`/activities?q=${encodeURIComponent(`${prefix} 06`)}`);
    await expect(page.getByRole("link", { name: `${prefix} 06` })).toBeVisible();
    await expect(page.getByRole("link", { name: `${prefix} 06` })).not.toContainText("เข้าร่วมแล้ว");
  });

  test("sort old → new puts the oldest first; the list view renders rows", async ({ page }) => {
    await signIn(page, student!, "/activities");
    await page.goto(`/activities?q=${prefix}&sort=old`);
    await expect(items(page)).toHaveCount(12);
    await expect(items(page).first()).toHaveText(`${prefix} 00`);
    await page.goto(`/activities?q=${prefix}&view=list`);
    await expect(page.getByRole("link", { name: "รายการ", exact: true })).toHaveAttribute("aria-current", "true");
    await expect(items(page)).toHaveCount(12);
    // rows: every title shares one column (same left edge), unlike the card grid
    const lefts = await items(page).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
  });

  test("visibility (R-P3): a matching closed activity the student never joined stays hidden", async ({ page }) => {
    await signIn(page, student!, "/activities");
    await page.goto(`/activities?q=${visPrefix}`);
    await expect(page.getByRole("link", { name: `${visPrefix} joined 00` })).toContainText("ปิดแล้ว");
    await expect(page.getByRole("link", { name: `${visPrefix} other 00` })).toHaveCount(0);
    await expect(items(page)).toHaveCount(1);
  });

  test("PostgREST metacharacters give the empty state, never an error", async ({ page }) => {
    await signIn(page, student!, "/activities");
    const res = await page.goto(`/activities?q=${encodeURIComponent('%,"')}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText("ไม่พบกิจกรรมที่ตรงกับคำค้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "ล้างการค้นหา" })).toHaveAttribute("href", "/activities");
  });

  test("no horizontal scroll at 360px in either view", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await signIn(page, student!, "/activities");
    for (const view of ["card", "list"]) {
      await page.goto(`/activities?q=${prefix}&view=${view}`);
      await expect(items(page)).toHaveCount(12);
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw, view).toBeLessThanOrEqual(cw);
    }
  });
});
