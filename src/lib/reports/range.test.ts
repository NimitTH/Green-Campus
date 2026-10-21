import { describe, expect, it } from "vitest";
import { MAX_RANGE_DAYS, bangkokMonthRange, parseDateRange } from "./range";

describe("parseDateRange", () => {
  it("accepts a valid inclusive range", () => {
    expect(parseDateRange("2033-05-01", "2033-05-31")).toEqual({ ok: true, from: "2033-05-01", to: "2033-05-31" });
    expect(parseDateRange("2033-05-01", "2033-05-01").ok).toBe(true);
  });
  it("rejects missing, malformed and impossible dates", () => {
    for (const [f, t] of [[null, "2033-05-01"], ["2033-05-01", null], ["2033-5-1", "2033-05-02"], ["2033-02-30", "2033-03-01"], ["x", "y"], ["2033-13-01", "2033-13-02"]] as const) {
      expect(parseDateRange(f, t).ok, `${f} ${t}`).toBe(false);
    }
  });
  it("rejects from > to", () => {
    expect(parseDateRange("2033-05-02", "2033-05-01").ok).toBe(false);
  });
  it("allows at most 731 days", () => {
    expect(MAX_RANGE_DAYS).toBe(731);
    expect(parseDateRange("2031-01-01", "2032-12-31").ok).toBe(true); // 731 days inclusive
    expect(parseDateRange("2031-01-01", "2033-01-01").ok).toBe(false);
  });
});

describe("bangkokMonthRange", () => {
  it("is the Bangkok calendar month of the instant", () => {
    expect(bangkokMonthRange(new Date("2026-10-21T00:00:00Z"))).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    // 2026-10-31T17:30Z is already 1 November in Bangkok
    expect(bangkokMonthRange(new Date("2026-10-31T17:30:00Z"))).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(bangkokMonthRange(new Date("2028-02-10T00:00:00Z"))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});
