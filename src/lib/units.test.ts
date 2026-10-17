import { describe, expect, it } from "vitest";
import { estimateWaste, toGrams, type Rates } from "./units";

describe("toGrams", () => {
  it.each([
    [1, 5, 1500],
    [0, 1, 100],
    [0.5, 0, 500],
    [0, 0, 0],
    [2, 0, 2000],
    [0.25, 3, 550],
  ])("toGrams(%s kg, %s khit) = %s g", (kg, khit, grams) => {
    expect(toGrams(kg, khit)).toBe(grams);
  });

  it("rounds fractional kg to the nearest gram", () => {
    expect(toGrams(0.0004, 0)).toBe(0);
    expect(toGrams(0.0006, 0)).toBe(1);
    expect(toGrams(1.2344, 0)).toBe(1234);
    expect(toGrams(1.2346, 0)).toBe(1235);
  });

  it("returns integers despite float noise in kg * 1000", () => {
    // 0.0015 * 1000 and 0.29 * 1000 are not exact in binary floating point.
    expect(toGrams(0.0015, 0)).toBe(2); // 0.0015 * 1000 === 1.5 in doubles
    expect(toGrams(0.29, 0)).toBe(290);
    expect(toGrams(1.1, 0)).toBe(1100);
    expect(toGrams(0.57, 2)).toBe(770);
  });

  it("documents half-gram edge cases (kg * 1000 is computed in binary floating point, then Math.round)", () => {
    // 1.0005 * 1000 evaluates to exactly 1000.5 in doubles, so it rounds half up.
    expect(toGrams(1.0005, 0)).toBe(1001);
    expect(toGrams(0.0005, 0)).toBe(1);
    // Just below the half-gram boundary rounds down.
    expect(toGrams(1.00049, 0)).toBe(1000);
  });

  it.each([-1, -0.001, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid kg %s",
    (kg) => {
      expect(() => toGrams(kg, 0)).toThrow(RangeError);
    },
  );

  it.each([-1, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid khit %s", (khit) => {
    expect(() => toGrams(1, khit)).toThrow(RangeError);
  });

  it("rejects non-number inputs", () => {
    expect(() => toGrams("1" as unknown as number, 0)).toThrow(TypeError);
    expect(() => toGrams(1, "1" as unknown as number)).toThrow(TypeError);
    expect(() => toGrams(null as unknown as number, 0)).toThrow(TypeError);
    expect(() => toGrams(undefined as unknown as number, 0)).toThrow(TypeError);
  });

  it("rejects unreasonably large totals", () => {
    expect(() => toGrams(1e12, 0)).toThrow(RangeError);
    expect(() => toGrams(0, 1e15)).toThrow(RangeError);
    expect(() => toGrams(Number.MAX_SAFE_INTEGER, 0)).toThrow(RangeError);
  });

  it("has a clear error message", () => {
    expect(() => toGrams(-1, 0)).toThrow(/kg/i);
    expect(() => toGrams(1, 0.5)).toThrow(/khit/i);
  });
});

const rates = (pointsPerKg: number, carbonKgPerKg = 0): Rates => ({ pointsPerKg, carbonKgPerKg });

describe("estimateWaste", () => {
  it("1500 g at 10 points/kg is 15 points", () => {
    expect(estimateWaste([{ grams: 1500, rates: rates(10) }]).points).toBe(15);
  });

  it("floors: 999 g at 1 point/kg is 0 points", () => {
    expect(estimateWaste([{ grams: 999, rates: rates(1) }]).points).toBe(0);
  });

  it("sums items before flooring", () => {
    expect(estimateWaste([{ grams: 500, rates: rates(1) }]).points).toBe(0);
    expect(
      estimateWaste([
        { grams: 500, rates: rates(1) },
        { grams: 500, rates: rates(1) },
      ]).points,
    ).toBe(1);
  });

  it("returns zeros for an empty list", () => {
    expect(estimateWaste([])).toEqual({ points: 0, carbonKg: 0 });
  });

  it("computes carbon in kg, rounded to 3 decimals", () => {
    expect(estimateWaste([{ grams: 1500, rates: rates(0, 0.5) }]).carbonKg).toBe(0.75);
    expect(estimateWaste([{ grams: 1234, rates: rates(0, 0.5) }]).carbonKg).toBe(0.617);
    // 1 g * 1.2346 / 1000 = 0.0012346 kg -> 0.001
    expect(estimateWaste([{ grams: 1, rates: rates(0, 1.2346) }]).carbonKg).toBe(0.001);
    // 777 g * 1.2346 / 1000 = 0.9592842 -> 0.959
    expect(estimateWaste([{ grams: 777, rates: rates(0, 1.2346) }]).carbonKg).toBe(0.959);
  });

  it("sums carbon across items before rounding once", () => {
    // each alone: 0.0004 -> 0; together: 0.0008 -> 0.001
    const item = { grams: 1, rates: rates(0, 0.4) };
    expect(estimateWaste([item]).carbonKg).toBe(0);
    expect(estimateWaste([item, item]).carbonKg).toBe(0.001);
  });

  it("is not thrown off by binary float drift", () => {
    // 5 g * 0.3 = 1.5 milli-kg exactly -> rounds half up to 0.002
    expect(estimateWaste([{ grams: 5, rates: rates(0, 0.3) }]).carbonKg).toBe(0.002);
    // 0.1 + 0.2 style accumulation
    const r = rates(0, 0.1);
    expect(
      estimateWaste([
        { grams: 1000, rates: r },
        { grams: 2000, rates: rates(0, 0.1) },
      ]).carbonKg,
    ).toBe(0.3);
  });

  it("combines points and carbon with per-item rates", () => {
    expect(
      estimateWaste([
        { grams: 1500, rates: rates(10, 2) },
        { grams: 2500, rates: rates(4, 0.5) },
      ]),
    ).toEqual({ points: 25, carbonKg: 4.25 });
  });

  it("does not lose precision on large integer sums", () => {
    expect(estimateWaste([{ grams: 1_000_000_000, rates: rates(1_000_000) }]).points).toBe(
      1_000_000_000_000,
    );
  });

  it("throws RangeError when the points sum would exceed the safe integer range", () => {
    // single product 1e9 * 1e8 = 1e17 > MAX_SAFE_INTEGER
    expect(() => estimateWaste([{ grams: 1_000_000_000, rates: rates(100_000_000) }])).toThrow(RangeError);
    // each product is safe (~5e15) but the running sum overflows
    const big = { grams: 500_000_000, rates: rates(10_000_000) };
    expect(() => estimateWaste([big, big])).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid grams %s", (grams) => {
    expect(() => estimateWaste([{ grams, rates: rates(1) }])).toThrow(RangeError);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid pointsPerKg %s", (p) => {
    expect(() => estimateWaste([{ grams: 100, rates: rates(p) }])).toThrow(RangeError);
  });

  it.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid carbonKgPerKg %s", (c) => {
    expect(() => estimateWaste([{ grams: 100, rates: rates(1, c) }])).toThrow(RangeError);
  });

  it("rejects non-number inputs", () => {
    expect(() => estimateWaste([{ grams: "1" as unknown as number, rates: rates(1) }])).toThrow(TypeError);
    expect(() => estimateWaste([{ grams: 1, rates: undefined as unknown as Rates }])).toThrow(TypeError);
    expect(() => estimateWaste(null as unknown as [])).toThrow(TypeError);
  });
});
