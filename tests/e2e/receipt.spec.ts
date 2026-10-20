import { readFile } from "node:fs/promises";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  checkoutAs,
  createConfirmedUser,
  createRewardRow,
  deleteRewardsByName,
  deleteUsers,
  grantPoints,
  makeOrderDue,
  signedInClient,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 14 (R88, R89): the receipt PDF route and the download button on /orders/[id].

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const orderNumber = (id: string) => id.slice(0, 8).toUpperCase();
const isPdf = (bytes: Buffer) => bytes.subarray(0, 4).toString("latin1") === "%PDF";

test("receipt: the owner downloads a PDF; other students 404, anonymous 401, staff 200", async ({ page, browser, baseURL }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `สมุดรีไซเคิลญี่ปุ่น ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;
  let other: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-rc-${suffix}`);
    student = await createConfirmedUser("student", `student-rc-${suffix}`);
    other = await createConfirmedUser("student", `other-rc-${suffix}`);
    await grantPoints(student.id, 100);
    const rewardId = await createRewardRow(name, 20, 5);
    const orderId = await checkoutAs(student, rewardId, 2);
    const url = `/api/receipts/${orderId}`;

    // owner: the button on the order page downloads the PDF
    await signIn(page, student, `/orders/${orderId}`);
    const link = page.getByRole("link", { name: "ดาวน์โหลดใบเสร็จ" });
    await expect(link).toHaveAttribute("href", url);
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toBe(`receipt-${orderNumber(orderId)}.pdf`);
    const path = await download.path();
    expect(isPdf(await readFile(path))).toBe(true);

    const own = await page.request.get(url);
    expect(own.status()).toBe(200);
    expect(own.headers()["content-type"]).toBe("application/pdf");
    expect(own.headers()["content-disposition"]).toBe(`attachment; filename="receipt-${orderNumber(orderId)}.pdf"`);
    expect(own.headers()["cache-control"]).toBe("private, no-store");
    expect(isPdf(await own.body())).toBe(true);

    // another student: 404 (the order's existence does not leak)
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, other, "/orders");
    expect((await otherPage.request.get(url)).status()).toBe(404);
    // a malformed id is 404 too
    expect((await otherPage.request.get("/api/receipts/not-a-uuid")).status()).toBe(404);
    await otherContext.close();

    // anonymous: 401
    const anon = await playwrightRequest.newContext({ baseURL });
    expect((await anon.get(url)).status()).toBe(401);
    await anon.dispose();

    // staff: 200 with a PDF
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await signIn(staffPage, teacher, "/staff");
    const staffRes = await staffPage.request.get(url);
    expect(staffRes.status()).toBe(200);
    expect(staffRes.headers()["content-type"]).toBe("application/pdf");
    expect(isPdf(await staffRes.body())).toBe(true);
    await staffContext.close();
  } finally {
    await deleteUsers([student, other, teacher]);
    await deleteRewardsByName([name]);
  }
});

test("receipt: the download button shows for every order status", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ถุงผ้าทุกสถานะ ${suffix}`;
  let admin: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    admin = await createConfirmedUser("admin", `admin-rcs-${suffix}`);
    student = await createConfirmedUser("student", `student-rcs-${suffix}`);
    await grantPoints(student.id, 100);
    const rewardId = await createRewardRow(name, 10, 10);
    const staff = await signedInClient(admin);

    const pending = await checkoutAs(student, rewardId, 1);
    const ready = await checkoutAs(student, rewardId, 1);
    expect((await staff.rpc("mark_order_ready", { p_order_id: ready })).error).toBeNull();
    const completed = await checkoutAs(student, rewardId, 1);
    expect((await staff.rpc("complete_order", { p_order_id: completed })).error).toBeNull();
    const cancelled = await checkoutAs(student, rewardId, 1);
    expect((await staff.rpc("cancel_order", { p_order_id: cancelled })).error).toBeNull();
    const expired = await checkoutAs(student, rewardId, 1);
    await makeOrderDue(expired);
    expect((await staff.rpc("expire_orders")).error).toBeNull();

    await signIn(page, student, "/orders");
    for (const [id, label] of [
      [pending, "รอเตรียมของ"],
      [ready, "พร้อมรับ"],
      [completed, "รับแล้ว"],
      [cancelled, "ยกเลิก"],
      [expired, "หมดอายุ"],
    ] as const) {
      await page.goto(`/orders/${id}`);
      await expect(page.getByTestId("order-status")).toHaveText(label);
      await expect(page.getByRole("link", { name: "ดาวน์โหลดใบเสร็จ" })).toHaveAttribute("href", `/api/receipts/${id}`);
      const res = await page.request.get(`/api/receipts/${id}`);
      expect(res.status()).toBe(200);
      expect(isPdf(await res.body())).toBe(true);
    }
  } finally {
    await deleteUsers([student, admin]);
    await deleteRewardsByName([name]);
  }
});
