import { describe, expect, it } from "vitest";
import { sortWasteRates, type WasteRate } from "./waste-rates";

const rate = (code: string, name = code): WasteRate => ({ code, name, pointsPerKg: 1, carbonKgPerKg: 1 });

describe("sortWasteRates", () => {
  it("puts known codes in fixed order and unknown codes last by name", () => {
    const sorted = sortWasteRates([rate("other"), rate("zzz", "ฮ"), rate("yyy", "ก"), rate("plastic"), rate("paper")]);
    expect(sorted.map((r) => r.code)).toEqual(["plastic", "paper", "other", "yyy", "zzz"]);
  });
});
