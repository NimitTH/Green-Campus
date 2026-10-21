import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  createConfirmedUser,
  deleteUsers,
  ledgerBalance,
  profileRole,
  rateByCode,
  restoreRate,
  setFullName,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 18 Part A (R118-R121): /staff dashboard cards, /staff/users (role change, adjust points) and
// /staff/rates (admin only). Shared rows (the plastic rate) are restored in finally.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const INTEGER_TEXT = /^\d{1,3}(,\d{3})*$/;

test("admin changes a student to teacher; that user can then open /staff", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ผู้ใช้เปลี่ยนบทบาท ${suffix}`;
  let adminUser: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    adminUser = await createConfirmedUser("admin", `admin-ad-role-${suffix}`);
    student = await createConfirmedUser("student", `student-ad-role-${suffix}`);
    await setFullName(student.id, name);

    await signIn(page, adminUser, "/staff");
    await page.getByRole("navigation", { name: "เมนูครู" }).getByRole("link", { name: /จัดการผู้ใช้/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/users");
    await page.getByRole("searchbox", { name: "ค้นหาชื่อ" }).fill(name);
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    const row = page.getByTestId("admin-user").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("user-role")).toHaveText("นักเรียน");
    await expect(row.getByTestId("user-points")).toHaveText("0");

    await row.getByLabel(`บทบาทของ ${name}`).selectOption("teacher");
    await row.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(row.getByText(`เปลี่ยน ${name} จาก นักเรียน เป็น ครู?`)).toBeVisible();
    await row.getByRole("button", { name: "ยืนยันเปลี่ยนบทบาท" }).click();
    await expect(row.getByTestId("user-role")).toHaveText("ครู");
    await expect.poll(() => profileRole(student!.id)).toBe("teacher");

    const ctx = await browser.newContext();
    try {
      const p2 = await ctx.newPage();
      await signIn(p2, student, "/staff");
      await expect(p2.getByRole("navigation", { name: "เมนูครู" })).toBeVisible();
      await expect(p2.getByRole("link", { name: /จัดการผู้ใช้/ })).toHaveCount(0); // teachers only
      await p2.goto("/notifications");
      await expect(p2.getByTestId("notification").filter({ hasText: "บทบาทของคุณถูกเปลี่ยน" })).toContainText("ครู");
    } finally {
      await ctx.close();
    }
  } finally {
    await deleteUsers([student, adminUser]);
  }
});

test("admin adjusts points with a note; the student sees the balance and a notification; over-deduction is refused", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const note = `โบนัสทดสอบ ${suffix}`;
  let adminUser: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    adminUser = await createConfirmedUser("admin", `admin-ad-adj-${suffix}`);
    student = await createConfirmedUser("student", `student-ad-adj-${suffix}`);

    await signIn(page, adminUser, `/staff/users/${student.id}`);
    await expect(page.getByTestId("detail-points")).toHaveText("0");

    // a missing reason is caught before the database
    await page.getByLabel("แต้ม (ใส่ลบเพื่อหัก)").fill("25");
    await page.getByRole("button", { name: "บันทึกการปรับแต้ม" }).click();
    await expect(page.getByText("ต้องระบุเหตุผลในการปรับแต้ม")).toBeVisible();

    await page.getByLabel("เหตุผล (นักเรียนจะเห็นข้อความนี้)").fill(note);
    await page.getByRole("button", { name: "บันทึกการปรับแต้ม" }).click();
    await expect(page.getByRole("status").filter({ hasText: "ปรับแต้มเรียบร้อยแล้ว" })).toBeVisible();
    await expect(page.getByTestId("detail-points")).toHaveText("25");
    await expect(page.getByTestId("ledger-row").filter({ hasText: note })).toContainText("+25 แต้ม");
    expect(await ledgerBalance(student.id)).toBe(25);

    // deducting more than the balance: the Thai refusal, nothing written
    await page.getByLabel("แต้ม (ใส่ลบเพื่อหัก)").fill("-26");
    await page.getByLabel("เหตุผล (นักเรียนจะเห็นข้อความนี้)").fill("หักเกินยอด");
    await page.getByRole("button", { name: "บันทึกการปรับแต้ม" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "แต้มคงเหลือไม่พอ" })).toBeVisible();
    expect(await ledgerBalance(student.id)).toBe(25);

    const ctx = await browser.newContext();
    try {
      const sp = await ctx.newPage();
      await signIn(sp, student, "/dashboard");
      await expect(sp.getByTestId("points")).toHaveText("25");
      await sp.goto("/notifications");
      const item = sp.getByTestId("notification").filter({ hasText: "มีการปรับแต้ม" });
      await expect(item).toHaveCount(1);
      await expect(item).toContainText("+25 แต้ม");
      await expect(item).toContainText(note);
    } finally {
      await ctx.close();
    }
  } finally {
    await deleteUsers([student, adminUser]);
  }
});

test("admin edits a rate; the value persists; a stale form is refused (restored afterwards)", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let adminUser: TestUser | undefined;
  const original = await rateByCode("plastic");

  try {
    adminUser = await createConfirmedUser("admin", `admin-ad-rate-${suffix}`);
    await signIn(page, adminUser, "/staff/rates");
    await expect(page.getByTestId("rates-note")).toContainText("ผลที่อนุมัติไปแล้วไม่เปลี่ยน");

    const form = page.getByTestId("rate-plastic");
    const points = form.getByLabel("แต้มต่อกิโลกรัม");
    await expect(points).toHaveValue(String(original.points_per_kg));
    const next = original.points_per_kg + 7;
    await points.fill(String(next));
    await form.getByRole("button", { name: "บันทึกอัตรา" }).click();
    await expect.poll(async () => (await rateByCode("plastic")).points_per_kg).toBe(next);
    await page.reload();
    await expect(page.getByTestId("rate-plastic").getByLabel("แต้มต่อกิโลกรัม")).toHaveValue(String(next));

    // another admin saves first: this form's version is stale, so the save is refused
    await restoreRate("plastic", { ...(await rateByCode("plastic")), source_note: `${original.source_note ?? ""} ` });
    const stale = page.getByTestId("rate-plastic");
    await stale.getByLabel("แต้มต่อกิโลกรัม").fill(String(next + 1));
    await stale.getByRole("button", { name: "บันทึกอัตรา" }).click();
    await expect(stale.getByRole("alert")).toContainText("ถูกแก้ไขไปแล้ว");
    expect((await rateByCode("plastic")).points_per_kg).toBe(next);
  } finally {
    await restoreRate("plastic", original);
    await deleteUsers([adminUser]);
  }
});

test("teachers cannot open /staff/users or /staff/rates and see no admin links", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-ad-${suffix}`);
    await signIn(page, teacher, "/staff");
    await expect(page.getByRole("link", { name: /จัดการผู้ใช้/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /อัตราแต้มและ carbon/ })).toHaveCount(0);
    for (const path of ["/staff/users", "/staff/rates", `/staff/users/${teacher.id}`]) {
      await page.goto(path);
      await expect(page, path).toHaveURL((url) => url.pathname === "/staff");
      await expect(page.getByRole("navigation", { name: "เมนูครู" })).toBeVisible();
    }
  } finally {
    await deleteUsers([teacher]);
  }
});

test("the /staff dashboard shows the work and totals cards", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-ad-dash-${suffix}`);
    await signIn(page, teacher, "/staff");

    const reviews = page.getByTestId("stat-pending-reviews");
    await expect(reviews).toContainText("งานรอตรวจ");
    await expect(reviews).toHaveAttribute("href", "/staff/reviews");
    expect((await reviews.getByTestId("stat-value").innerText()).trim()).toMatch(INTEGER_TEXT);

    const pickup = page.getByTestId("stat-pending-pickup");
    await expect(pickup).toContainText("ออเดอร์รอรับ");
    await expect(pickup).toHaveAttribute("href", "/staff/orders");
    expect((await pickup.getByTestId("stat-value").innerText()).trim()).toMatch(INTEGER_TEXT);
    expect((await pickup.getByTestId("stat-ready").innerText()).trim()).toMatch(INTEGER_TEXT);

    const totals = page.getByTestId("stat-totals");
    await expect(totals).toContainText("carbon ที่ลดได้");
    await expect(totals).toContainText("ขยะที่เก็บ");
    await expect(totals).toContainText("ต้นไม้ที่ปลูก");
    await expect(page.getByTestId("stat-open-activities")).toContainText("กิจกรรมที่เปิดอยู่");
  } finally {
    await deleteUsers([teacher]);
  }
});
