import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  confirmSignedUpUser,
  createConfirmedUser,
  createRewardRow,
  deleteActivitiesByTitle,
  deleteRewardsByName,
  deleteUsers,
  type TestUser,
} from "./helpers/supabase-admin";
import { bangkokInputValue } from "./helpers/time";

// Task 20 (R139): the demo-day script of spec 13.3, end to end through the UI, with its own fresh users
// (it does not depend on the demo seed): register -> join -> the teacher issues a weigh code -> submit
// with the code and a photo -> the teacher approves and the student's bell rises live -> cart + checkout
// -> receipt PDF -> the teacher marks ready and confirms the pickup (รับแล้ว) -> leaderboard -> summary PDF.

const isPdf = (bytes: Buffer) => bytes.subarray(0, 4).toString("latin1") === "%PDF";
const orderNumber = (id: string) => id.slice(0, 8).toUpperCase();

async function unreadCount(page: Page): Promise<number> {
  const bell = page.getByRole("link", { name: /^แจ้งเตือน/ });
  await expect(bell).toHaveAttribute("data-realtime", "subscribed");
  const name = (await bell.getAttribute("aria-label")) ?? (await bell.textContent()) ?? "";
  const m = /ยังไม่อ่าน (\d+) รายการ/.exec(name);
  return m ? Number(m[1]) : 0;
}

test("demo script: register, join, weigh code, submit, approve (live bell), redeem, receipt, pickup, leaderboard, report", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = `${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = `กิจกรรมสาธิตเต็มเส้นทาง ${suffix}`;
  const rewardName = `ถุงผ้าสาธิต ${suffix}`;
  const fullName = `ผู้ชมสาธิต ${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-ff-${suffix}@example.test`.toLowerCase();
  const password = `Ff-${Math.random().toString(36).slice(2, 10)}-pass`;
  let student: TestUser | undefined;
  let teacher: TestUser | undefined;
  const staffContext = await browser.newContext();

  try {
    teacher = await createConfirmedUser("teacher", `teacher-ff-${suffix}`);
    await createRewardRow(rewardName, 15, 3);

    // 1. register through /register (confirmation is on locally: confirm through the admin helper)
    await page.goto("/register");
    await page.getByLabel("ชื่อ-นามสกุลจริง", { exact: true }).fill(fullName);
    await page.getByLabel("อีเมล", { exact: true }).fill(email);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
    await page.getByLabel("ยืนยันรหัสผ่าน", { exact: true }).fill(password);
    await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
    await expect(page.getByText("ตรวจอีเมลของคุณ")).toBeVisible();
    student = await confirmSignedUpUser(email, password);

    // the teacher creates the activity live (waste: a weigh code is required by default)
    const staff = await staffContext.newPage();
    await signIn(staff, teacher, "/staff/activities/new");
    await staff.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(title);
    await staff.getByLabel("วันเวลาเริ่ม", { exact: true }).fill(bangkokInputValue(-60));
    await staff.getByLabel("วันเวลาสิ้นสุด", { exact: true }).fill(bangkokInputValue(24 * 60));
    await staff.getByRole("radio", { name: "ชั่งน้ำหนักขยะ" }).check();
    await expect(staff.getByLabel("ต้องใช้รหัสยืนยันจากจุดชั่งเมื่อส่งผล")).toBeChecked();
    await staff.getByLabel("สถานะ", { exact: true }).selectOption("open");
    await staff.getByRole("button", { name: "บันทึกกิจกรรม" }).click();
    await expect(staff).toHaveURL((url) => url.pathname === "/staff/activities");

    // 2. the student signs in and joins
    await signIn(page, student, "/activities");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const activityPath = new URL(page.url()).pathname;
    await page.getByRole("button", { name: "เข้าร่วมกิจกรรม" }).click();
    await expect(page.getByRole("button", { name: "เข้าร่วมแล้ว" })).toBeDisabled();

    // 3. the teacher issues a code at the weigh station
    await staff.goto("/staff/weigh-station");
    await staff.getByLabel("กิจกรรม", { exact: true }).filter({ visible: true }).selectOption({ label: title });
    await staff.getByRole("button", { name: /^ออกรหัสให้ / }).filter({ visible: true }).click();
    const codeLocator = staff.getByTestId("weigh-code").filter({ visible: true });
    await expect(codeLocator).toHaveText(/^\d{6}$/);
    const code = (await codeLocator.textContent())!.trim();

    // 4. the student submits 2 kg of plastic with the code and a photo
    await page.goto(activityPath);
    await page.getByRole("link", { name: "ส่งผล", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === `${activityPath}/submit`);
    await page.getByLabel("พลาสติก กิโลกรัม").fill("2");
    await page.getByLabel("รูปหลักฐาน").setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByLabel("รหัสจากจุดชั่ง (6 หลัก)").fill(code);
    await page.getByRole("button", { name: "ส่งผล" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/my-submissions");
    await expect(page.getByTestId("submission").filter({ hasText: title })).toContainText("รอตรวจ");

    // 5. the teacher approves; the student's bell rises live (Realtime, no reload)
    await page.goto("/dashboard");
    const before = await unreadCount(page);
    await staff.goto("/staff/reviews");
    await staff.getByTestId("review-row").filter({ hasText: title }).getByRole("link").click();
    await staff.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await expect(staff).toHaveURL((url) => url.pathname === "/staff/reviews");
    await expect(page.getByRole("link", { name: /^แจ้งเตือน/ })).toHaveAccessibleName(`แจ้งเตือน ยังไม่อ่าน ${before + 1} รายการ`, {
      timeout: 5000,
    });
    await page.getByRole("link", { name: /^แจ้งเตือน/ }).click();
    await expect(page.getByTestId("notification").filter({ hasText: "ผลของคุณได้รับการอนุมัติ" }).first()).toBeVisible();

    // 6. the student puts a reward in the cart and checks out
    await page.goto("/rewards");
    const card = page.getByTestId("reward-card").filter({ hasText: rewardName });
    await card.getByRole("button", { name: "ใส่ตะกร้า" }).click();
    await expect(card.getByRole("status")).toContainText("ใส่ตะกร้าแล้ว");
    await page.goto("/cart");
    await page.getByRole("button", { name: "ยืนยันแลก" }).click();
    await expect(page).toHaveURL((url) => /^\/orders\/[0-9a-f-]{36}$/.test(url.pathname));
    const orderId = new URL(page.url()).pathname.split("/")[2];
    await expect(page.getByTestId("order-status")).toHaveText("รอเตรียมของ");

    // 7. the receipt PDF
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "ดาวน์โหลดใบเสร็จ" }).click()]);
    expect(download.suggestedFilename()).toBe(`receipt-${orderNumber(orderId)}.pdf`);
    expect(isPdf(await readFile(await download.path()))).toBe(true);

    // 8. the teacher marks it ready, then confirms the pickup; the student sees รับแล้ว
    await staff.goto(`/staff/orders?q=${orderNumber(orderId)}`);
    const staffOrder = staff.getByTestId("staff-order").filter({ hasText: orderNumber(orderId) });
    await staffOrder.getByRole("button", { name: "เตรียมของเสร็จแล้ว" }).click();
    await expect(staffOrder.getByTestId("order-status")).toHaveText("พร้อมรับ");
    await staffOrder.getByRole("button", { name: "ยืนยันรับแล้ว" }).click();
    await expect(staffOrder.getByTestId("order-status")).toHaveText("รับแล้ว");
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-status")).toHaveText("รับแล้ว");

    // 9. the leaderboard shows the student; the teacher downloads the summary PDF
    await page.goto("/leaderboard");
    await expect(page.getByTestId("lb-me")).toContainText(fullName);
    await expect(page.getByTestId("lb-me")).toContainText("2.062");
    await staff.goto("/staff/reports");
    const [report] = await Promise.all([staff.waitForEvent("download"), staff.getByRole("link", { name: "ดาวน์โหลด PDF สรุป" }).click()]);
    expect(isPdf(await readFile(await report.path()))).toBe(true);
  } finally {
    await staffContext.close();
    // signed up but not confirmed yet (a failure right after /register): find the account to delete it
    if (!student) student = await confirmSignedUpUser(email, password).catch(() => undefined);
    // activities first: it removes the submission and its evidence file
    await deleteActivitiesByTitle(title);
    await deleteUsers([student, teacher]);
    await deleteRewardsByName([rewardName]);
  }
});
