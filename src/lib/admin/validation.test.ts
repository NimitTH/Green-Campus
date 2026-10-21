import { describe, expect, it } from "vitest";
import {
  cleanSearchTerm,
  hasStringFields,
  signed,
  toPage,
  toRoleFilter,
  validateAdjust,
  validateRate,
} from "./validation";

describe("validateAdjust", () => {
  it("accepts signed points and carbon with up to 3 decimals, trimming the note", () => {
    expect(validateAdjust({ points: "-15", carbonKg: "0.125", note: "  แก้ยอด  " })).toEqual({
      ok: true,
      value: { points: -15, carbonKg: 0.125, note: "แก้ยอด" },
    });
    expect(validateAdjust({ points: "+5", carbonKg: "", note: "x" })).toEqual({ ok: true, value: { points: 5, carbonKg: 0, note: "x" } });
    expect(validateAdjust({ points: "", carbonKg: "-1.5", note: "x" })).toEqual({ ok: true, value: { points: 0, carbonKg: -1.5, note: "x" } });
  });
  it("requires a note", () => {
    const r = validateAdjust({ points: "5", carbonKg: "", note: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.note).toContain("ต้องระบุเหตุผล");
  });
  it("rejects a note over 500 characters", () => {
    const r = validateAdjust({ points: "5", carbonKg: "", note: "ก".repeat(501) });
    expect(r.ok).toBe(false);
  });
  it.each(["1.5", "abc", "5000000", "--1", "1e3"])("rejects points %j", (points) => {
    const r = validateAdjust({ points, carbonKg: "", note: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.points).toBeTruthy();
  });
  it.each(["0.1234", "abc", "1,5", "2000000"])("rejects carbon %j", (carbonKg) => {
    const r = validateAdjust({ points: "1", carbonKg, note: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.carbonKg).toBeTruthy();
  });
  it("rejects an empty adjustment", () => {
    for (const [points, carbonKg] of [["", ""], ["0", "0"], ["-0", "0.000"]]) {
      const r = validateAdjust({ points, carbonKg, note: "x" });
      expect(r.ok).toBe(false);
    }
  });
});

describe("validateRate", () => {
  const good = { name: " พลาสติก  ใส ", pointsPerKg: "10", carbonKgPerKg: "1.031", sourceNote: " อบก. 2565 " };
  it("accepts and normalises a valid row", () => {
    expect(validateRate(good)).toEqual({
      ok: true,
      value: { name: "พลาสติก ใส", points_per_kg: 10, carbon_kg_per_kg: 1.031, source_note: "อบก. 2565" },
    });
  });
  it.each([
    ["name", { name: "  " }],
    ["pointsPerKg", { pointsPerKg: "-1" }],
    ["pointsPerKg", { pointsPerKg: "1.5" }],
    ["carbonKgPerKg", { carbonKgPerKg: "1.0315" }],
    ["carbonKgPerKg", { carbonKgPerKg: "-0.1" }],
    ["sourceNote", { sourceNote: "" }],
  ] as const)("flags %s", (field, patch) => {
    const r = validateRate({ ...good, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors[field]).toBeTruthy();
  });
});

describe("small helpers", () => {
  it("toRoleFilter / toPage", () => {
    expect(toRoleFilter("teacher")).toBe("teacher");
    expect(toRoleFilter("root")).toBe("all");
    expect(toRoleFilter(undefined)).toBe("all");
    expect(toPage("3")).toBe(3);
    expect(toPage("0")).toBe(1);
    expect(toPage("-2")).toBe(1);
    expect(toPage(["2"])).toBe(1);
  });
  it("cleanSearchTerm strips filter syntax", () => {
    expect(cleanSearchTerm(" สม%ชาย,(x) ")).toBe("สม ชาย x");
    expect(cleanSearchTerm(42)).toBe("");
  });
  it("hasStringFields", () => {
    expect(hasStringFields({ a: "1", b: "2" }, ["a", "b"])).toBe(true);
    expect(hasStringFields({ a: 1 }, ["a"])).toBe(false);
    expect(hasStringFields([], ["a"])).toBe(false);
  });
  it("signed", () => {
    expect(signed(5)).toBe("+5");
    expect(signed(-2)).toBe("-2");
    expect(signed(0)).toBe("0");
  });
});
