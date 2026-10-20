import { describe, expect, it } from "vitest";
import { formatKg, formatKgFromGrams, parsePublicStats } from "./format";

describe("leaderboard format", () => {
  it("formats kg with th-TH grouping and at most 3 decimals", () => {
    expect(formatKg(1234.5678)).toBe("1,234.568");
    expect(formatKg(0)).toBe("0");
    expect(formatKg(2.5)).toBe("2.5");
  });

  it("converts grams to kg", () => {
    expect(formatKgFromGrams(1550)).toBe("1.55");
    expect(formatKgFromGrams(0)).toBe("0");
  });

  it("parses public_stats and rejects malformed input", () => {
    expect(parsePublicStats({ carbon_kg: 12.5, waste_grams: 3000, trees: 4 })).toEqual({ carbonKg: 12.5, wasteGrams: 3000, trees: 4 });
    expect(parsePublicStats(null)).toBeNull();
    expect(parsePublicStats({ carbon_kg: "x", waste_grams: 1, trees: 1 })).toBeNull();
    expect(parsePublicStats({})).toBeNull();
  });
});
