import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  checkoutAs,
  createConfirmedUser,
  createRewardRow,
  deleteActivitiesByTitle,
  deleteRewardsByName,
  deleteUsers,
  findReward,
  grantPoints,
  ledgerBalance,
  listCart,
  listLedgerForOrder,
  listOrders,
  makeOrderDue,
  seedApprovedEarn,
  setRewardStock,
  signedInClient,
  updateReward,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 13 (R77, R79): checkout, staff pickup/cancel, expiry, and two concurrency races.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const orderNumber = (id: string) => id.slice(0, 8).toUpperCase();
const card = (page: Page, name: string) => page.getByTestId("reward-card").filter({ hasText: name });
const staffOrder = (page: Page, id: string) => page.getByTestId("staff-order").filter({ hasText: orderNumber(id) });

type CheckoutResult = {
  ok: boolean;
  error_code: string | null;
  order_id: string | null;
  blocked: { reward_id: string | null; reason: string; available?: number; shortfall?: number }[];
};

test("earn -> cart -> ยืนยันแลก -> staff notified -> เตรียมของเสร็จแล้ว -> พร้อมรับ -> teacher confirms pickup -> รับแล้ว", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const title = `กิจกรรมแต้มแลก ${suffix}`;
  const name = `กระบอกน้ำ ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  let other: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-co-${suffix}`);
    student = await createConfirmedUser("student", `student-co-${suffix}`);
    other = await createConfirmedUser("student", `other-co-${suffix}`);
    await seedApprovedEarn(student, teacher, 50, title);
    expect(await ledgerBalance(student.id)).toBe(50);
    const rewardId = await createRewardRow(name, 20, 3);

    // student: empty order list, then add to cart and redeem
    await signIn(page, student, "/orders");
    await expect(page.getByText("ยังไม่มีออเดอร์")).toBeVisible();
    await page.goto("/rewards");
    await card(page, name).getByRole("button", { name: "ใส่ตะกร้า" }).click();
    await expect(card(page, name).getByRole("status")).toContainText("ใส่ตะกร้าแล้ว");
    await page.goto("/cart");
    await page.getByRole("button", { name: "ยืนยันแลก" }).click();
    await expect(page).toHaveURL((url) => /^\/orders\/[0-9a-f-]{36}$/.test(url.pathname));
    const orderId = new URL(page.url()).pathname.split("/")[2];

    await expect(page.getByTestId("order-status")).toHaveText("รอเตรียมของ");
    await expect(page.getByTestId("order-number")).toHaveText(orderNumber(orderId));
    await expect(page.getByText("รับของที่แผนกก่อนวันที่")).toBeVisible();
    await expect(page.getByTestId("order-item").filter({ hasText: name })).toContainText("20");
    await expect(page.getByTestId("order-total")).toHaveText("20 แต้ม");
    expect(await ledgerBalance(student.id)).toBe(30);
    expect((await findReward(name))?.stock).toBe(2);
    expect(await listCart(student.id)).toHaveLength(0);

    // the list shows it too
    await page.getByRole("link", { name: "ออเดอร์" }).first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/orders");
    const row = page.getByTestId("order-row").filter({ hasText: orderNumber(orderId) });
    await expect(row.getByTestId("order-status")).toHaveText("รอเตรียมของ");
    await expect(row).toContainText("20 แต้ม");

    // another student cannot open it
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, other, "/orders");
    await otherPage.goto(`/orders/${orderId}`);
    await expect(otherPage.getByText("This page could not be found")).toBeVisible();
    await expect(otherPage.getByTestId("order-number")).toHaveCount(0);
    await otherContext.close();

    // teacher: the new order raised an order_new notification
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await signIn(staffPage, teacher, "/staff");
    await staffPage.goto("/notifications");
    await expect(staffPage.getByText("มีออเดอร์ใหม่").first()).toBeVisible();

    // teacher: /staff -> ออเดอร์ -> เตรียมของเสร็จแล้ว
    await staffPage.goto("/staff");
    await staffPage.getByRole("link", { name: /ออเดอร์/ }).click();
    await expect(staffPage).toHaveURL((url) => url.pathname === "/staff/orders");
    await expect(staffPage.getByRole("button", { name: "ยกเลิกออเดอร์ที่หมดอายุ" })).toHaveCount(0); // admin only
    await expect(staffOrder(staffPage, orderId).getByTestId("order-status")).toHaveText("รอเตรียมของ");
    await staffOrder(staffPage, orderId).getByRole("button", { name: "เตรียมของเสร็จแล้ว" }).click();
    await expect(staffOrder(staffPage, orderId).getByTestId("order-status")).toHaveText("พร้อมรับ");
    await expect(staffOrder(staffPage, orderId).getByRole("button", { name: "เตรียมของเสร็จแล้ว" })).toHaveCount(0);
    await expect.poll(async () => (await listOrders(student!.id))[0]?.status).toBe("pending_pickup");

    // student: พร้อมรับ on the order and the list, and a notification
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-status")).toHaveText("พร้อมรับ");
    await expect(page.getByText("ของพร้อมแล้ว รับที่แผนกก่อนวันที่")).toBeVisible();
    await page.goto("/orders");
    await expect(page.getByTestId("order-row").filter({ hasText: orderNumber(orderId) }).getByTestId("order-status")).toHaveText("พร้อมรับ");
    await page.goto("/notifications");
    await expect(page.getByText("ของรางวัลพร้อมรับแล้ว").first()).toBeVisible();

    // teacher confirms the pickup
    await staffOrder(staffPage, orderId).getByRole("button", { name: "ยืนยันรับแล้ว" }).click();
    await expect(staffOrder(staffPage, orderId).getByTestId("order-status")).toHaveText("รับแล้ว");
    await expect.poll(async () => (await listOrders(student!.id))[0]?.status).toBe("completed");
    await staffContext.close();

    // student: status and notification
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-status")).toHaveText("รับแล้ว");
    await expect(page.getByText("รับของที่แผนกก่อนวันที่")).toHaveCount(0);
    await page.goto("/notifications");
    await expect(page.getByText("รับของรางวัลแล้ว").first()).toBeVisible();
    await expect(page.getByText("แลกของรางวัลสำเร็จ").first()).toBeVisible();

    // the order keeps the name it was ordered under after a rename and deactivation
    await updateReward(rewardId, { name: `${name} (ใหม่)`, active: false });
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-item")).toContainText(`${name}1 ชิ้น`);
    await expect(page.getByTestId("order-item")).not.toContainText("(ใหม่)");
  } finally {
    // activities first: it removes the submissions' evidence files, which a user delete would orphan
    await deleteActivitiesByTitle(title);
    await deleteUsers([student, other, teacher]);
    await deleteRewardsByName([name, `${name} (ใหม่)`]);
  }
});

test("teacher cancels an order (with a confirm step): stock and points come back", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ถุงผ้ายกเลิก ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-cancel-${suffix}`);
    student = await createConfirmedUser("student", `student-cancel-${suffix}`);
    await grantPoints(student.id, 100);
    const rewardId = await createRewardRow(name, 25, 4);
    const orderId = await checkoutAs(student, rewardId, 2);
    expect(await ledgerBalance(student.id)).toBe(50);
    expect((await findReward(name))?.stock).toBe(2);

    await signIn(page, teacher, "/staff/orders");
    // search by order number prefix
    await page.getByLabel("ค้นหา").fill(orderNumber(orderId).slice(0, 6).toLowerCase());
    await page.getByRole("button", { name: "ค้นหา" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === orderNumber(orderId).slice(0, 6).toLowerCase());
    await expect(page.getByTestId("staff-order")).toHaveCount(1);
    // search by student name (every e2e user is named "ทดสอบ <role>")
    await page.getByLabel("ค้นหา").fill("ทดสอบ stud");
    await page.getByRole("button", { name: "ค้นหา" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("q") === "ทดสอบ stud");
    await expect(staffOrder(page, orderId)).toBeVisible();
    await page.getByLabel("ค้นหา").fill("ไม่มีชื่อนี้แน่นอน");
    await page.getByRole("button", { name: "ค้นหา" }).click();
    await expect(page.getByText("ไม่พบออเดอร์ที่ตรงกับคำค้น")).toBeVisible();
    await page.getByLabel("ค้นหา").fill(orderNumber(orderId));
    await page.getByRole("button", { name: "ค้นหา" }).click();
    await expect(page.getByTestId("staff-order")).toHaveCount(1);
    const row = staffOrder(page, orderId);
    await row.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    await row.getByRole("button", { name: "ยืนยันยกเลิก" }).click();
    await expect(row.getByTestId("order-status")).toHaveText("ยกเลิก");

    await expect.poll(async () => (await listOrders(student!.id))[0]?.status).toBe("cancelled");
    expect(await ledgerBalance(student.id)).toBe(100);
    expect((await findReward(name))?.stock).toBe(4);

    // a second cancel through the API is refused and refunds nothing more
    const c = await signedInClient(teacher);
    const { error } = await c.rpc("cancel_order", { p_order_id: orderId });
    expect(error?.message).toBe("order_not_pending");
    expect(await ledgerBalance(student.id)).toBe(100);
  } finally {
    await deleteUsers([student, teacher]);
    await deleteRewardsByName([name]);
  }
});

test("cart: ยืนยันแลก is disabled without enough points and shows Thai reasons when blocked", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ของสต็อกน้อย ${suffix}`;
  let student: TestUser | undefined;

  try {
    student = await createConfirmedUser("student", `student-block-${suffix}`);
    const rewardId = await createRewardRow(name, 40, 2);
    const c = await signedInClient(student);
    const { error } = await c.from("cart_items").insert({ student_id: student.id, reward_id: rewardId, qty: 1 });
    expect(error).toBeNull();

    await signIn(page, student, "/cart");
    await expect(page.getByRole("button", { name: "ยืนยันแลก" })).toBeDisabled();

    await grantPoints(student.id, 100);
    await page.reload();
    const button = page.getByRole("button", { name: "ยืนยันแลก" });
    await expect(button).toBeEnabled();

    // stock runs out after the page loaded
    await setRewardStock(rewardId, 0);
    await button.click();
    await expect(page.getByTestId("checkout-blocked")).toContainText("สต็อกเหลือ 0");
    await expect(page.getByTestId("checkout-blocked")).toContainText(name);
    expect(await listOrders(student.id)).toHaveLength(0);
    expect(await ledgerBalance(student.id)).toBe(100);
  } finally {
    await deleteUsers([student]);
    await deleteRewardsByName([name]);
  }
});

test("admin expires due orders with the button; stock and points come back", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ของหมดอายุ ${suffix}`;
  let admin: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    admin = await createConfirmedUser("admin", `admin-exp-${suffix}`);
    student = await createConfirmedUser("student", `student-exp-${suffix}`);
    await grantPoints(student.id, 60);
    const rewardId = await createRewardRow(name, 30, 3);
    const orderId = await checkoutAs(student, rewardId, 1);
    await makeOrderDue(orderId);

    // overdue but not yet expired: the order page says so instead of the pickup deadline (4a)
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await signIn(studentPage, student, `/orders/${orderId}`);
    await expect(studentPage.getByTestId("order-overdue")).toHaveText("เลยกำหนดรับแล้ว ระบบจะคืนแต้มให้อัตโนมัติ");
    await expect(studentPage.getByText("รับของที่แผนกก่อนวันที่")).toHaveCount(0);
    await studentContext.close();

    await signIn(page, admin, "/staff/orders");
    await page.getByRole("button", { name: "ยกเลิกออเดอร์ที่หมดอายุ" }).click();
    await expect(page.getByRole("status").filter({ hasText: "ยกเลิกออเดอร์ที่หมดอายุแล้ว" })).toContainText(/ยกเลิกออเดอร์ที่หมดอายุแล้ว [1-9]\d* ออเดอร์/);
    await expect.poll(async () => (await listOrders(student!.id))[0]?.status).toBe("expired");
    expect(await ledgerBalance(student.id)).toBe(60);
    expect((await findReward(name))?.stock).toBe(3);
  } finally {
    await deleteUsers([student, admin]);
    await deleteRewardsByName([name]);
  }
});

test("(ง) two concurrent checkouts with points for one order: exactly one succeeds", async ({}, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ของแข่งแต้ม ${suffix}`;
  let student: TestUser | undefined;

  try {
    student = await createConfirmedUser("student", `student-race-pts-${suffix}`);
    await grantPoints(student.id, 30);
    const rewardId = await createRewardRow(name, 30, 5);
    const [a, b] = await Promise.all([signedInClient(student), signedInClient(student)]);
    const { error } = await a.from("cart_items").insert({ student_id: student.id, reward_id: rewardId, qty: 1 });
    expect(error).toBeNull();

    const results = await Promise.all([a.rpc("checkout"), b.rpc("checkout")]);
    for (const r of results) expect(r.error).toBeNull();
    const data = results.map((r) => r.data as CheckoutResult);
    expect(data.filter((d) => d.ok)).toHaveLength(1);
    const loser = data.find((d) => !d.ok)!;
    const pointsBlocked = loser.error_code === "blocked" && loser.blocked.some((x) => x.reason === "points");
    expect(loser.error_code === "cart_empty" || pointsBlocked).toBe(true);

    expect(await listOrders(student.id)).toHaveLength(1);
    const balance = await ledgerBalance(student.id);
    expect(balance).toBe(0);
    expect(balance).toBeGreaterThanOrEqual(0);
    expect((await findReward(name))?.stock).toBe(4);
  } finally {
    await deleteUsers([student]);
    await deleteRewardsByName([name]);
  }
});

test("(จ) one item left, two students redeem at once: only one gets it", async ({}, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ชิ้นสุดท้าย ${suffix}`;
  let s1: TestUser | undefined;
  let s2: TestUser | undefined;

  try {
    s1 = await createConfirmedUser("student", `student-race-a-${suffix}`);
    s2 = await createConfirmedUser("student", `student-race-b-${suffix}`);
    await grantPoints(s1.id, 50);
    await grantPoints(s2.id, 50);
    const rewardId = await createRewardRow(name, 10, 1);
    const [a, b] = await Promise.all([signedInClient(s1), signedInClient(s2)]);
    for (const [c, s] of [[a, s1], [b, s2]] as const) {
      const { error } = await c.from("cart_items").insert({ student_id: s.id, reward_id: rewardId, qty: 1 });
      expect(error).toBeNull();
    }

    const results = await Promise.all([a.rpc("checkout"), b.rpc("checkout")]);
    for (const r of results) expect(r.error).toBeNull();
    const data = results.map((r) => r.data as CheckoutResult);
    expect(data.filter((d) => d.ok)).toHaveLength(1);
    const loser = data.find((d) => !d.ok)!;
    expect(loser.error_code).toBe("blocked");
    expect(loser.blocked).toEqual([{ reward_id: rewardId, reason: "stock", available: 0 }]);

    const orders = [...(await listOrders(s1.id)), ...(await listOrders(s2.id))];
    expect(orders).toHaveLength(1);
    expect((await findReward(name))?.stock).toBe(0);
    const balances = [await ledgerBalance(s1.id), await ledgerBalance(s2.id)].sort((x, y) => x - y);
    expect(balances).toEqual([40, 50]);
  } finally {
    await deleteUsers([s1, s2]);
    await deleteRewardsByName([name]);
  }
});

test("cancel_order and checkout on a shared reward at the same moment: no deadlock, sums stay right", async ({}, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ของแข่งยกเลิก ${suffix}`;
  const rounds = 3;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-race-cancel-${suffix}`);
    student = await createConfirmedUser("student", `student-race-cancel-${suffix}`);
    await grantPoints(student.id, 100);
    const rewardId = await createRewardRow(name, 10, 10);
    const [staff, own] = await Promise.all([signedInClient(teacher), signedInClient(student)]);
    const cancelled: string[] = [];

    for (let round = 0; round < rounds; round++) {
      // a pending order holding the reward, and the same reward in the cart again
      const pendingId = await checkoutAs(student, rewardId, 1);
      const { error: cartError } = await own.from("cart_items").insert({ student_id: student.id, reward_id: rewardId, qty: 1 });
      expect(cartError).toBeNull();

      // checkout locks profile -> reward; cancel locks order -> reward and its inserts check the FK
      // to the same profile (KEY SHARE). With a FOR UPDATE profile lock this pair could deadlock.
      const [cancel, checkout] = await Promise.all([
        staff.rpc("cancel_order", { p_order_id: pendingId }),
        own.rpc("checkout"),
      ]);
      expect(cancel.error?.code).not.toBe("40P01");
      expect(checkout.error?.code).not.toBe("40P01");
      expect(cancel.error).toBeNull();
      expect(checkout.error).toBeNull();
      expect((checkout.data as CheckoutResult).ok).toBe(true);
      cancelled.push(pendingId);
    }

    // each round: one order cancelled (stock and points back), one order kept
    const orders = await listOrders(student.id);
    expect(orders.filter((o) => o.status === "cancelled").map((o) => o.id).sort()).toEqual([...cancelled].sort());
    expect(orders.filter((o) => o.status === "pending_pickup")).toHaveLength(rounds);
    expect((await findReward(name))?.stock).toBe(10 - rounds);
    expect(await ledgerBalance(student.id)).toBe(100 - 10 * rounds);
    for (const id of cancelled) {
      const rows = await listLedgerForOrder(id);
      expect(rows.filter((r) => r.kind === "refund")).toEqual([{ kind: "refund", points: 10 }]);
      expect(rows.filter((r) => r.kind === "redeem")).toEqual([{ kind: "redeem", points: -10 }]);
    }
    expect(await listCart(student.id)).toHaveLength(0);
  } finally {
    await deleteUsers([student, teacher]);
    await deleteRewardsByName([name]);
  }
});
