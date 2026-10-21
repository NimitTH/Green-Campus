import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { createConfirmedUser, deleteRewardsByName, deleteUsers, findReward, type TestUser } from "./helpers/supabase-admin";

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
