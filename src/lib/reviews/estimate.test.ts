import { describe, expect, it } from "vitest";
import { estimateSubmission } from "./estimate";

const plastic = { name: "พลาสติก", pointsPerKg: 10, carbonKgPerKg: 1.031 };
const paper = { name: "กระดาษ", pointsPerKg: 5, carbonKgPerKg: 3.546 };

describe("estimateSubmission (mirrors approve_submission, spec 6.1)", () => {
  it("waste 1500 g plastic", () => {
    const activity = { type: "waste" as const, unitPoints: 0, unitCarbonKg: null };
    expect(estimateSubmission(activity, [{ quantity: 1500, category: plastic }])).toEqual({ points: 15, carbonKg: 1.547 });
  });
  it("waste rounds once over the sum", () => {
    const activity = { type: "waste" as const, unitPoints: 0, unitCarbonKg: null };
    const items = [
      { quantity: 150, category: plastic },
      { quantity: 100, category: paper },
    ];
    expect(estimateSubmission(activity, items)).toEqual({ points: 2, carbonKg: 0.509 });
  });
  it("trees: count x unit values, null carbon = 0", () => {
    expect(estimateSubmission({ type: "trees", unitPoints: 5, unitCarbonKg: 2.5 }, [{ quantity: 3, category: null }])).toEqual({
      points: 15,
      carbonKg: 7.5,
    });
    expect(estimateSubmission({ type: "trees", unitPoints: 5, unitCarbonKg: null }, [{ quantity: 3, category: null }])).toEqual({
      points: 15,
      carbonKg: 0,
    });
  });
  it("fixed: unit values", () => {
    expect(estimateSubmission({ type: "fixed", unitPoints: 10, unitCarbonKg: 1.25 }, [{ quantity: 1, category: null }])).toEqual({
      points: 10,
      carbonKg: 1.25,
    });
    expect(estimateSubmission({ type: "fixed", unitPoints: 10, unitCarbonKg: null }, [])).toEqual({ points: 10, carbonKg: 0 });
  });
});
