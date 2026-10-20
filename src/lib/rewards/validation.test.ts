import { describe, expect, it } from "vitest";
import { MAX_CART_QTY, checkCartQty, isRewardInputShape, rewardToInput, validateReward, type RewardInput } from "./validation";

const valid: RewardInput = { name: "สมุด", pointsCost: "50", stock: "10", active: true };

describe("validateReward", () => {
  it("accepts a valid reward and trims the name", () => {
    expect(validateReward({ ...valid, name: "  สมุด   เล่มใหญ่ " })).toEqual({
      ok: true,
      value: { name: "สมุด เล่มใหญ่", points_cost: 50, stock: 10, active: true },
    });
  });

  it("requires a name of at most 100 characters", () => {
    expect(validateReward({ ...valid, name: "   " })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(validateReward({ ...valid, name: "ก".repeat(101) })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });
    expect(validateReward({ ...valid, name: "ก".repeat(100) }).ok).toBe(true);
  });

  it("requires points_cost to be an integer above 0", () => {
    for (const bad of ["", "0", "-5", "1.5", "abc", "1e3", "10000001"]) {
      expect(validateReward({ ...valid, pointsCost: bad })).toMatchObject({ ok: false, fieldErrors: { pointsCost: expect.any(String) } });
    }
    expect(validateReward({ ...valid, pointsCost: "1" }).ok).toBe(true);
  });

  it("requires stock to be an integer of at least 0", () => {
    for (const bad of ["", "-1", "2.5", "x", "100000001"]) {
      expect(validateReward({ ...valid, stock: bad })).toMatchObject({ ok: false, fieldErrors: { stock: expect.any(String) } });
    }
    expect(validateReward({ ...valid, stock: "0" })).toMatchObject({ ok: true, value: { stock: 0 } });
  });

  it("reports every bad field at once", () => {
    const r = validateReward({ name: "", pointsCost: "0", stock: "-1", active: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["name", "pointsCost", "stock"]);
  });
});

describe("isRewardInputShape", () => {
  it("accepts plain objects with string fields and a boolean active", () => {
    expect(isRewardInputShape(valid)).toBe(true);
    expect(isRewardInputShape({ ...valid, id: "x" })).toBe(true);
  });
  it("rejects other payloads", () => {
    expect(isRewardInputShape(null)).toBe(false);
    expect(isRewardInputShape([])).toBe(false);
    expect(isRewardInputShape({ ...valid, pointsCost: 5 })).toBe(false);
    expect(isRewardInputShape({ ...valid, active: "yes" })).toBe(false);
    expect(isRewardInputShape({ ...valid, id: 3 })).toBe(false);
  });
});

describe("rewardToInput", () => {
  it("maps a stored row to form values", () => {
    expect(rewardToInput({ name: "สมุด", points_cost: 50, stock: 0, active: false })).toEqual({
      name: "สมุด",
      pointsCost: "50",
      stock: "0",
      active: false,
    });
  });
});

describe("checkCartQty", () => {
  it("accepts integers up to the maximum", () => {
    expect(checkCartQty(1)).toEqual({ ok: true, qty: 1 });
    expect(checkCartQty(MAX_CART_QTY)).toEqual({ ok: true, qty: MAX_CART_QTY });
    expect(checkCartQty(0)).toEqual({ ok: true, qty: 0 });
    expect(checkCartQty(-3)).toEqual({ ok: true, qty: -3 });
  });
  it("rejects above the maximum and non-integers", () => {
    expect(checkCartQty(MAX_CART_QTY + 1)).toMatchObject({ ok: false, error: expect.stringContaining("99") });
    for (const bad of [1.5, Number.NaN, Infinity, "2", null, undefined]) {
      expect(checkCartQty(bad)).toMatchObject({ ok: false });
    }
  });
});
