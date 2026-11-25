import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  createOrderFor,
  createRewardRow,
  deleteActivitiesByTitle,
  deleteRewardsByName,
  deleteUsers,
  listOrders,
  seedSubmission,
  setActivityCover,
  signedInClient,
  type TestUser,
  orderNoOf,
} from "./helpers/supabase-admin";

// Redesign 4 Task 4: search, sort and pagination on /orders; search, sort, pagination and the card/list view on /rewards.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const names = (page: Page) => page.getByTestId("reward-card").locator("h2").allTextContents();

test("/rewards: pagination, price and stock sorts, list view, search", async ({ page }, testInfo) => {
  const prefix = `รางวัลลิสต์ ${uniqueSuffix(testInfo.project.name)}`;
  const rewardNames = Array.from({ length: 13 }, (_, i) => `${prefix} ${String(i + 1).padStart(2, "0")}`);
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-sl-${uniqueSuffix(testInfo.project.name)}`);
    // cost 10..130 in name order; stock 130..10 (so price asc = name asc, stock desc = name asc too, price desc = last first)
    for (const [i, name] of rewardNames.entries()) await createRewardRow(name, (i + 1) * 10, (13 - i) * 10);
    await signIn(page, student, "/rewards");

    const q = encodeURIComponent(prefix);
    await page.goto(`/rewards?q=${q}`);
    await expect(page.getByTestId("reward-card")).toHaveCount(12);
    const pager = page.getByRole("navigation", { name: "แบ่งหน้า" });
    await pager.getByRole("link", { name: "หน้าถัดไป" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("reward-card")).toHaveCount(1);
    // the add-to-cart button and the balance stay
    await expect(page.getByTestId("reward-card").getByRole("button", { name: "ใส่ตะกร้า" })).toBeVisible();
    await expect(page.getByTestId("balance")).toBeVisible();

    await page.goto(`/rewards?q=${q}&sort=price`);
    expect((await names(page))[0]).toBe(rewardNames[0]);
    await page.goto(`/rewards?q=${q}&sort=price&dir=desc`);
    expect((await names(page))[0]).toBe(rewardNames[12]);
    await page.goto(`/rewards?q=${q}&sort=stock`);
    expect((await names(page))[0]).toBe(rewardNames[0]);
    await page.goto(`/rewards?q=${q}&sort=stock&dir=asc`);
    expect((await names(page))[0]).toBe(rewardNames[12]);

    await page.goto(`/rewards?q=${q}&view=list`);
    await expect(page.getByTestId("reward-card")).toHaveCount(12);
    await expect(page.locator("ul.divide-y > li[data-testid='reward-card']")).toHaveCount(12);

    await page.goto(`/rewards?q=${encodeURIComponent(rewardNames[4])}`);
    await expect(page.getByTestId("reward-card")).toHaveCount(1);
    await page.goto(`/rewards?q=${encodeURIComponent(prefix + " zzz")}`);
    await expect(page.getByText("ไม่พบรายการที่ตรงกับคำค้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "ล้างการค้นหา" })).toHaveAttribute("href", "/rewards");
    await page.goto(`/rewards?q=${q}&page=999`);
    await expect(page.getByTestId("reward-card")).toHaveCount(1);
  } finally {
    await deleteUsers([student]);
    await deleteRewardsByName(rewardNames);
  }
});

test("/orders: search by reward name and by order number, no-match, pagination", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const alpha = `สมุดอัลฟา ${suffix}`;
  const beta = `ปากกาเบต้า ${suffix}`;
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-so-${suffix}`);
    const a = await createRewardRow(alpha, 5, 100);
    const b = await createRewardRow(beta, 5, 100);
    await createOrderFor(student.id, a, 1, 5, alpha);
    await createOrderFor(student.id, b, 1, 5, beta);
    const orders = await listOrders(student.id);
    const alphaOrder = orders[0].id;
    await signIn(page, student, "/orders");
    await expect(page.getByTestId("order-row")).toHaveCount(2);

    await page.getByRole("searchbox", { name: "ค้นหาสินค้าหรือเลขที่ออเดอร์" }).fill(alpha);
    await page.getByRole("searchbox", { name: "ค้นหาสินค้าหรือเลขที่ออเดอร์" }).press("Enter");
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByTestId("order-row")).toHaveCount(1);
    const alphaNo = await orderNoOf(alphaOrder);
    await expect(page.getByTestId("order-row")).toContainText(alphaNo);

    // round 6: the full ORD- number finds the order; the old 8-hex prefix still does too
    await page.goto(`/orders?q=${encodeURIComponent(alphaNo)}`);
    await expect(page.getByTestId("order-row")).toHaveCount(1);
    await expect(page.getByTestId("order-row")).toContainText(alphaNo);
    await page.goto(`/orders?q=${alphaOrder.slice(0, 8)}`);
    await expect(page.getByTestId("order-row")).toHaveCount(1);
    await expect(page.getByTestId("order-row")).toContainText(alphaNo);

    await page.goto(`/orders?q=${encodeURIComponent("ไม่มีของนี้ " + suffix)}`);
    await expect(page.getByText("ไม่พบรายการที่ตรงกับคำค้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "ล้างการค้นหา" })).toHaveAttribute("href", "/orders");

    await page.goto("/orders?page=999");
    await expect(page.getByTestId("order-row")).toHaveCount(2);
    await page.goto("/orders?dir=asc");
    await expect(page.getByTestId("order-row").first()).toContainText(alphaNo);
  } finally {
    await deleteUsers([student]);
    await deleteRewardsByName([alpha, beta]);
  }
});

test("/my-submissions: status sort, cover link to the activity, list view, search, no-match, 360 px", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const titleA = `กิจกรรมอนุมัติ ${suffix}`;
  const titleB = `กิจกรรมรอตรวจ ${suffix}`;
  let student: TestUser | undefined;
  let teacher: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `student-ms-${suffix}`);
    teacher = await createConfirmedUser("teacher", `teacher-ms-${suffix}`);
    const idB = await createJoinedCodeActivity(titleB, student.id, { requires_code: false });
    await seedSubmission(student, idB, PNG_1X1); // older, stays pending
    await setActivityCover(idB);
    const idA = await createJoinedCodeActivity(titleA, student.id, { requires_code: false, unit_points: 25 });
    const submissionA = await seedSubmission(student, idA, PNG_1X1); // newer, approved
    const { error } = await (await signedInClient(teacher)).rpc("approve_submission", { p_submission_id: submissionA });
    expect(error).toBeNull();

    await signIn(page, student, "/my-submissions");
    const items = page.getByTestId("submission");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText(titleA); // date desc: newest first
    await expect(items.first()).toContainText("ได้ 25 แต้ม");
    await page.goto("/my-submissions?sort=status");
    await expect(items.first()).toContainText(titleB); // pending first
    await expect(page.getByRole("link", { name: "รอตรวจก่อน, กดเพื่อเปลี่ยนเป็น ปฏิเสธก่อน", exact: true })).toHaveText("รอตรวจก่อน");
    await page.goto("/my-submissions?sort=status&dir=desc");
    await expect(items.first()).toContainText(titleA);
    await expect(page.getByRole("link", { name: "ปฏิเสธก่อน, กดเพื่อเปลี่ยนเป็น รอตรวจก่อน", exact: true })).toHaveText("ปฏิเสธก่อน");
    await page.goto("/my-submissions?sort=points");
    await expect(items.first()).toContainText(titleA);
    await page.goto("/my-submissions?sort=name&dir=desc&view=list");
    await expect(page.locator("ul.divide-y > li[data-testid='submission']")).toHaveCount(2);
    await page.goto("/my-submissions?sort=bogus&dir=up&page=999");
    await expect(items).toHaveCount(2);

    // the cover (the only link in an item) goes to the activity; an item without a cover has the fallback link too
    await page.goto("/my-submissions");
    const itemB = items.filter({ hasText: titleB });
    await expect(itemB.locator("img")).toHaveAttribute("src", /\/storage\/v1\/object\/public\/activity-images\//);
    await expect(itemB.getByRole("link")).toHaveCount(1);
    await itemB.getByRole("link", { name: `ดูกิจกรรม ${titleB}` }).click();
    await expect(page).toHaveURL((url) => url.pathname === `/activities/${idB}`);

    await page.goto(`/my-submissions?q=${encodeURIComponent(titleA)}`);
    await expect(items).toHaveCount(1);
    await expect(items).toContainText(titleA);
    await page.goto(`/my-submissions?q=${encodeURIComponent("ไม่มีกิจกรรมนี้ " + suffix)}`);
    await expect(page.getByText("ไม่พบรายการที่ตรงกับคำค้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "ล้างการค้นหา" })).toHaveAttribute("href", "/my-submissions");

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/my-submissions");
    await expect(items).toHaveCount(2);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  } finally {
    await deleteUsers([student, teacher]);
    await deleteActivitiesByTitle(titleA);
    await deleteActivitiesByTitle(titleB);
  }
});

// a11y follow-ups O1: the student shell has the same skip link.
test("student shell skip link focuses the content", async ({ page }, testInfo) => {
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `skip-stu-${uniqueSuffix(testInfo.project.name)}`);
    await signIn(page, student, "/activities");
    await page.reload(); // fresh load: sequential focus starts at the top
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "ข้ามไปเนื้อหา" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-main-content]").filter({ visible: true })).toBeFocused();
  } finally {
    await deleteUsers([student]);
  }
});
