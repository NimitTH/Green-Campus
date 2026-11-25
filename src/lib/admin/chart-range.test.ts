import { describe, expect, it } from "vitest";
import { parseChartRange, wasteSince } from "./chart-range";

describe("parseChartRange", () => {
  it("reads valid values", () => {
    expect(parseChartRange({ months: "12", waste: "30d" })).toEqual({ months: 12, waste: "30d" });
  });
  it("falls back to 6 months and all waste for missing or unknown values", () => {
    expect(parseChartRange({})).toEqual({ months: 6, waste: "all" });
    expect(parseChartRange({ months: "24", waste: "7d" })).toEqual({ months: 6, waste: "all" });
    expect(parseChartRange({ months: "12abc", waste: "ALL" })).toEqual({ months: 6, waste: "all" });
  });
});

describe("wasteSince", () => {
  const now = new Date("2026-11-25T03:00:00Z");
  it("is null for all", () => {
    expect(wasteSince("all", now)).toBeNull();
  });
  it("30d starts at Bangkok midnight 29 days before today", () => {
    expect(wasteSince("30d", now)).toBe("2026-10-26T17:00:00.000Z");
  });
  it("12m starts at Bangkok midnight on the day after the same date last year", () => {
    expect(wasteSince("12m", now)).toBe("2025-11-25T17:00:00.000Z");
  });
});
