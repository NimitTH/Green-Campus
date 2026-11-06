import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { createConfirmedUser, createOrderFor, createRewardRow, deleteRewardsByName, deleteUsers, listOrders, type TestUser } from "./helpers/supabase-admin";

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
    await expect(page.getByTestId("order-row")).toContainText(alphaOrder.slice(0, 8).toUpperCase());

    await page.goto(`/orders?q=${alphaOrder.slice(0, 8)}`);
    await expect(page.getByTestId("order-row")).toHaveCount(1);
    await expect(page.getByTestId("order-row")).toContainText(alphaOrder.slice(0, 8).toUpperCase());

    await page.goto(`/orders?q=${encodeURIComponent("ไม่มีของนี้ " + suffix)}`);
    await expect(page.getByText("ไม่พบรายการที่ตรงกับคำค้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "ล้างการค้นหา" })).toHaveAttribute("href", "/orders");

    await page.goto("/orders?page=999");
    await expect(page.getByTestId("order-row")).toHaveCount(2);
    await page.goto("/orders?dir=asc");
    await expect(page.getByTestId("order-row").first()).toContainText(alphaOrder.slice(0, 8).toUpperCase());
  } finally {
    await deleteUsers([student]);
    await deleteRewardsByName([alpha, beta]);
  }
});
