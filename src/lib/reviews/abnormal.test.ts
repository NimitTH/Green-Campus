import { describe, expect, it } from "vitest";
import { isAbnormalTotal, submissionTotal } from "./abnormal";

describe("submissionTotal", () => {
  it("waste: sum of grams", () => {
    expect(submissionTotal("waste", [1500, 200])).toBe(1700);
  });
  it("trees: the count", () => {
    expect(submissionTotal("trees", [3])).toBe(3);
  });
  it("fixed: no total (never flagged)", () => {
    expect(submissionTotal("fixed", [1])).toBeNull();
  });
});

describe("isAbnormalTotal", () => {
  it("no other submissions -> no flag", () => {
    expect(isAbnormalTotal(1_000_000, [])).toBe(false);
  });
  it("more than 3 x the average of the others -> flag", () => {
    // average 1000, 3 x = 3000
    expect(isAbnormalTotal(3001, [500, 1500])).toBe(true);
  });
  it("exactly 3 x the average -> no flag (strictly greater)", () => {
    expect(isAbnormalTotal(3000, [500, 1500])).toBe(false);
  });
  it("below -> no flag", () => {
    expect(isAbnormalTotal(100, [500, 1500])).toBe(false);
  });
  it("exact comparison without float drift", () => {
    // average 1/3 ... x 3 = 1: 1 is not > 1
    expect(isAbnormalTotal(1, [1, 0, 0])).toBe(false);
    expect(isAbnormalTotal(2, [1, 0, 0])).toBe(true);
  });
  it("null total (fixed) -> no flag", () => {
    expect(isAbnormalTotal(null, [1, 2])).toBe(false);
  });
});
