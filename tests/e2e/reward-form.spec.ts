import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { createConfirmedUser, createRewardRow, deleteRewardsByName, deleteUsers, findReward, type TestUser } from "./helpers/supabase-admin";

// Task 18 Part B fix round 1: Cache Components keep a visited route alive (hidden <Activity>), so the
// reward form must start fresh after a save. Two creates and two edits in a row, no full reload.

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function createFromList(page: Page, name: string, points: string) {
  await page.getByRole("link", { name: "เพิ่มของรางวัล" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/staff/rewards/new");
  await expect(page.getByLabel("ชื่อของรางวัล").filter({ visible: true })).toHaveValue("");
  await page.getByLabel("ชื่อของรางวัล").filter({ visible: true }).fill(name);
  await page.getByLabel("แต้มที่ใช้แลก").filter({ visible: true }).fill(points);
  await page.getByLabel("จำนวนในสต็อก").filter({ visible: true }).fill("3");
  await page.getByRole("button", { name: "บันทึกของรางวัล" }).filter({ visible: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/staff/rewards");
  await expect(page.getByTestId("staff-reward").filter({ hasText: name })).toBeVisible();
}

test("staff create two rewards in a row and edit one twice without a reload", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const first = `รางวัลแรก ${suffix}`;
  const second = `รางวัลสอง ${suffix}`;
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-rform-${suffix}`);
    await signIn(page, teacher, "/staff/rewards");

    await createFromList(page, first, "11");
    await createFromList(page, second, "22");
    const a = await findReward(first);
    const b = await findReward(second);
    expect(a?.points_cost).toBe(11);
    expect(b?.points_cost).toBe(22);
    expect(a?.id).not.toBe(b?.id);

    // the same edit route twice
    for (const points of ["33", "44"]) {
      await page.getByRole("link", { name: `แก้ไข ${first}` }).click();
      await expect(page).toHaveURL((url) => url.pathname === `/staff/rewards/${a!.id}/edit`);
      await page.getByLabel("แต้มที่ใช้แลก").filter({ visible: true }).fill(points);
      await page.getByRole("button", { name: "บันทึกของรางวัล" }).filter({ visible: true }).click();
      await expect(page).toHaveURL((url) => url.pathname === "/staff/rewards");
      await expect.poll(async () => (await findReward(first))?.points_cost).toBe(Number(points));
    }
  } finally {
    await deleteRewardsByName([first, second]);
    await deleteUsers([teacher]);
  }
});

// Redesign 4 Task 10: /staff/rewards search, active filter, sorts, back link.
test("staff rewards list: active filter, points sort, search and back link", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const prefix = `รางวัลลิสต์ ${suffix}`;
  const names = [`${prefix} เปิดแพง`, `${prefix} เปิดถูก`, `${prefix} ปิด`];
  let teacher: TestUser | undefined;
  try {
    teacher = await createConfirmedUser("teacher", `teacher-rlist-${suffix}`);
    await createRewardRow(names[0], 90, 5);
    await createRewardRow(names[1], 10, 5);
    await createRewardRow(names[2], 50, 5, false);

    const q = encodeURIComponent(prefix);
    const rows = page.getByTestId("staff-reward");
    await signIn(page, teacher, "/staff/rewards");
    await page.goto(`/staff/rewards?q=${q}`);
    await expect(page.getByRole("link", { name: "กลับ", exact: true })).toHaveAttribute("href", "/staff");
    await expect(rows).toHaveCount(3);
    await page.goto(`/staff/rewards?q=${q}&active=no`);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(names[2]);
    await page.goto(`/staff/rewards?q=${q}&active=yes&sort=points`);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(names[1]);
    await expect(rows.nth(1)).toContainText(names[0]);
    // the toolbar filter reaches the URL
    await page.getByLabel("สถานะ", { exact: true }).selectOption("no");
    await expect(page).toHaveURL((url) => url.searchParams.get("active") === "no");
    await expect(rows).toHaveCount(1);
    // search with no match
    await page.goto(`/staff/rewards?q=${encodeURIComponent(`${prefix} ไม่มีแน่นอน`)}`);
    await expect(page.getByText("ไม่พบรายการที่ตรงกับคำค้น")).toBeVisible();
    await expect(page.getByRole("link", { name: "ล้างการค้นหา" })).toBeVisible();
  } finally {
    await deleteRewardsByName(names);
    await deleteUsers([teacher]);
  }
});
