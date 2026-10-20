import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createRewardRow,
  deleteRewardsByName,
  deleteUsers,
  findReward,
  grantPoints,
  listCart,
  setRewardActive,
  signedInClient,
  type TestUser,
} from "./helpers/supabase-admin";

// Plan Task 12.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const card = (page: Page, name: string) => page.getByTestId("reward-card").filter({ hasText: name });
const line = (page: Page, name: string) => page.getByTestId("cart-line").filter({ hasText: name });

test("staff creates a reward with an image, the student fills a cart and the total is right", async ({ page, browser }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const nameA = `สมุดรีไซเคิล ${suffix}`;
  const nameB = `ปากกา ${suffix}`;
  const nameC = `ถุงผ้า ${suffix}`;
  const nameOut = `หมดสต็อก ${suffix}`;
  let teacher: TestUser | undefined;
  let student: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-cart-${suffix}`);
    student = await createConfirmedUser("student", `student-cart-${suffix}`);

    // staff creates reward A through the form, with an image
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await signIn(staffPage, teacher, "/staff/rewards/new");
    await staffPage.getByLabel("ชื่อของรางวัล").fill(nameA);
    await staffPage.getByLabel("แต้มที่ใช้แลก").fill("40");
    await staffPage.getByLabel("จำนวนในสต็อก").fill("1");
    await staffPage.getByLabel("รูปของรางวัล").setInputFiles({ name: "reward.png", mimeType: "image/png", buffer: PNG_1X1 });
    await staffPage.getByRole("button", { name: "บันทึกของรางวัล" }).click();
    await expect(staffPage).toHaveURL((url) => url.pathname === "/staff/rewards");
    const staffRow = staffPage.getByTestId("staff-reward").filter({ hasText: nameA });
    await expect(staffRow).toBeVisible();
    await expect(staffRow.locator("img")).toHaveAttribute("src", /\/storage\/v1\/object\/public\/reward-images\//);
    const stored = await findReward(nameA);
    expect(stored).toMatchObject({ points_cost: 40, stock: 1, active: true });
    expect(stored?.image_path).toMatch(new RegExp(`^${stored?.id}/[0-9a-f-]{36}\\.jpg$`));
    await staffContext.close();

    const idB = await createRewardRow(nameB, 30, 5);
    await createRewardRow(nameOut, 10, 0);
    const idC = await createRewardRow(nameC, 20, 5);

    // student: balance 0 first
    await signIn(page, student, "/rewards");
    await expect(page.getByTestId("balance")).toContainText("0");
    await expect(card(page, nameA).locator("img")).toBeVisible();
    // out of stock: shown, button disabled
    await expect(card(page, nameOut)).toContainText("หมดแล้ว");
    await expect(card(page, nameOut).getByRole("button", { name: "ใส่ตะกร้า" })).toBeDisabled();

    // add A twice and B once
    await card(page, nameA).getByRole("button", { name: "ใส่ตะกร้า" }).click();
    await expect(card(page, nameA).getByRole("status")).toContainText("ใส่ตะกร้าแล้ว");
    await card(page, nameA).getByRole("button", { name: "ใส่ตะกร้า" }).click();
    await expect.poll(async () => (await listCart(student!.id)).some((c) => c.qty === 2)).toBe(true);
    await card(page, nameB).getByRole("button", { name: "ใส่ตะกร้า" }).click();
    await expect(card(page, nameB).getByRole("status")).toContainText("ใส่ตะกร้าแล้ว");
    expect(await listCart(student.id)).toHaveLength(2);

    // a reward deactivated after the page loaded cannot be added
    await setRewardActive(idC, false);
    await card(page, nameC).getByRole("button", { name: "ใส่ตะกร้า" }).click();
    await expect(card(page, nameC).getByRole("alert")).toContainText("ของรางวัลนี้ไม่เปิดให้แลกแล้ว");
    expect((await listCart(student.id)).some((c) => c.reward_id === idC)).toBe(false);
    // ...and it is gone from the list after a reload; the database refuses it too
    await page.reload();
    await expect(card(page, nameA)).toBeVisible();
    await expect(page.getByTestId("reward-card").filter({ hasText: nameC })).toHaveCount(0);
    const client = await signedInClient(student);
    const { error: rlsError } = await client.from("cart_items").insert({ student_id: student.id, reward_id: idC, qty: 1 });
    expect(rlsError).not.toBeNull();

    // cart: 2 x 40 + 1 x 30 = 110, balance 0 -> not enough points, stock warning for A (stock 1)
    await page.getByRole("link", { name: "ตะกร้า" }).first().click();
    await expect(page).toHaveURL((url) => url.pathname === "/cart");
    await expect(line(page, nameA).getByTestId("cart-qty")).toHaveText("2");
    await expect(line(page, nameA)).toContainText("80");
    await expect(line(page, nameA)).toContainText("สต็อกเหลือ 1 ชิ้น");
    await expect(line(page, nameB)).toContainText("30");
    await expect(page.getByTestId("cart-total")).toContainText("110");
    await expect(page.getByText("แต้มไม่พอ")).toBeVisible();

    // enough points -> warning disappears
    await grantPoints(student.id, 200);
    await page.reload();
    await expect(page.getByTestId("balance")).toContainText("200");
    await expect(page.getByText("แต้มไม่พอ")).toHaveCount(0);

    // stepper: + on B gives 2 x 30; - twice removes the line
    await line(page, nameB).getByRole("button", { name: "เพิ่มจำนวน" }).click();
    await expect(line(page, nameB).getByTestId("cart-qty")).toHaveText("2");
    await expect(page.getByTestId("cart-total")).toContainText("140");
    await line(page, nameB).getByRole("button", { name: "ลดจำนวน" }).click();
    await expect(line(page, nameB).getByTestId("cart-qty")).toHaveText("1");
    await line(page, nameB).getByRole("button", { name: "ลดจำนวน" }).click();
    await expect(line(page, nameB)).toHaveCount(0);
    await expect(page.getByTestId("cart-total")).toContainText("80");
    expect((await listCart(student.id)).some((c) => c.reward_id === idB)).toBe(false);

    // remove button clears the last line
    await line(page, nameA).getByRole("button", { name: "เอาออกจากตะกร้า" }).click();
    await expect(page.getByTestId("cart-line")).toHaveCount(0);
    await expect(page.getByText("ตะกร้าว่าง")).toBeVisible();
    expect(await listCart(student.id)).toHaveLength(0);
  } finally {
    await deleteRewardsByName([nameA, nameB, nameC, nameOut]);
    await deleteUsers([teacher, student]);
  }
});

test("staff browse /rewards without add buttons, and reopen an inactive reward in the manager", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const closed = `ของปิดแลก ${suffix}`;
  const open = `ของเปิด ${suffix}`;
  let teacher: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-browse-${suffix}`);
    await createRewardRow(open, 15, 3);
    await createRewardRow(closed, 25, 3, false);

    await signIn(page, teacher, "/rewards");
    await expect(page.getByTestId("reward-card").filter({ hasText: open })).toBeVisible();
    await expect(page.getByTestId("reward-card").filter({ hasText: closed })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ใส่ตะกร้า" })).toHaveCount(0);

    await page.goto("/staff/rewards");
    const row = page.getByTestId("staff-reward").filter({ hasText: closed });
    await expect(row).toContainText("ปิดการแลก");
    await row.getByRole("button", { name: /^เปิดให้แลก/ }).click();
    await expect.poll(async () => (await findReward(closed))?.active).toBe(true);
  } finally {
    await deleteRewardsByName([open, closed]);
    await deleteUsers([teacher]);
  }
});
