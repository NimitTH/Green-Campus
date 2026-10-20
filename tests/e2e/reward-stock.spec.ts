import { expect, test } from "@playwright/test";
import { signIn } from "./helpers/auth";
import {
  createConfirmedUser,
  createRewardRow,
  deleteRewardsByName,
  deleteUsers,
  findReward,
  setRewardStock,
  type TestUser,
} from "./helpers/supabase-admin";

// Phase 2 review R91: a reward edit form must not write back the stock it loaded when the stock
// changed underneath it (a checkout, cancel or expiry while the teacher was editing).

function uniqueSuffix(projectName: string): string {
  return `${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const STALE = "สต็อกเปลี่ยนระหว่างแก้ไข กรุณาโหลดใหม่";

test("a stale edit form keeps the newer stock on a name change and refuses a stock change", async ({ page }, testInfo) => {
  const suffix = uniqueSuffix(testInfo.project.name);
  const name = `ของสต็อกเปลี่ยน ${suffix}`;
  const renamed = `${name} ใหม่`;
  let teacher: TestUser | undefined;

  try {
    teacher = await createConfirmedUser("teacher", `teacher-stock-${suffix}`);
    const id = await createRewardRow(name, 10, 5);

    // 1. load the form (stock 5), stock changes behind it (a checkout took 2), save a rename only
    await signIn(page, teacher, `/staff/rewards/${id}/edit`);
    await expect(page.getByLabel("จำนวนในสต็อก")).toHaveValue("5");
    await setRewardStock(id, 3);
    await page.getByLabel("ชื่อของรางวัล").fill(renamed);
    await page.getByRole("button", { name: "บันทึกของรางวัล" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/rewards");
    let row = await findReward(renamed);
    expect(row?.name).toBe(renamed);
    expect(row?.stock).toBe(3); // the newer value, not the 5 the form loaded

    // 2. load again (stock 3), stock changes behind it, the teacher edits the stock: refused
    await page.goto(`/staff/rewards/${id}/edit`);
    await expect(page.getByLabel("จำนวนในสต็อก")).toHaveValue("3");
    await setRewardStock(id, 2);
    await page.getByLabel("ชื่อของรางวัล").fill(name);
    await page.getByLabel("จำนวนในสต็อก").fill("10");
    await page.getByRole("button", { name: "บันทึกของรางวัล" }).click();
    await expect(page.getByRole("alert").filter({ hasText: STALE })).toBeVisible();
    row = await findReward(renamed);
    expect(row?.stock).toBe(2); // nothing changed: not the stock ...
    expect(row?.name).toBe(renamed); // ... and not the other fields either
    await expect(page).toHaveURL((url) => url.pathname === `/staff/rewards/${id}/edit`);

    // 3. after a reload the same stock edit goes through
    await page.reload();
    await expect(page.getByLabel("จำนวนในสต็อก")).toHaveValue("2");
    await page.getByLabel("จำนวนในสต็อก").fill("10");
    await page.getByRole("button", { name: "บันทึกของรางวัล" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/staff/rewards");
    expect((await findReward(renamed))?.stock).toBe(10);
  } finally {
    await deleteRewardsByName([name, renamed]);
    await deleteUsers([teacher]);
  }
});
