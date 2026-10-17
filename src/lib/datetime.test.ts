import { describe, expect, it } from "vitest";
import { bangkokLocalToUtcIso, formatBangkok, utcToBangkokLocal } from "./datetime";

describe("bangkokLocalToUtcIso", () => {
  it("treats the input as Asia/Bangkok (UTC+7) wall time", () => {
    expect(bangkokLocalToUtcIso("2026-10-17T08:30")).toBe("2026-10-17T01:30:00.000Z");
  });
  it("crosses the date line backwards for early-morning times", () => {
    expect(bangkokLocalToUtcIso("2026-11-01T06:59")).toBe("2026-10-31T23:59:00.000Z");
  });
  it("accepts optional seconds", () => {
    expect(bangkokLocalToUtcIso("2026-10-17T08:30:15")).toBe("2026-10-17T01:30:15.000Z");
  });
  it.each(["", "2026-10-17", "2026-13-01T10:00", "2026-02-30T10:00", "2026-10-17T24:00", "abc", "2026-10-17 08:30"])(
    "rejects %j",
    (value) => expect(bangkokLocalToUtcIso(value)).toBeNull(),
  );
});

describe("utcToBangkokLocal", () => {
  it("formats a UTC instant for <input type=datetime-local> in Bangkok time", () => {
    expect(utcToBangkokLocal("2026-10-31T16:30:00Z")).toBe("2026-10-31T23:30");
    expect(utcToBangkokLocal("2026-10-31T17:00:00+00:00")).toBe("2026-11-01T00:00");
  });
  it("round-trips with bangkokLocalToUtcIso", () => {
    const local = "2027-02-15T13:05";
    expect(utcToBangkokLocal(bangkokLocalToUtcIso(local)!)).toBe(local);
  });
  it("returns empty string for invalid input", () => {
    expect(utcToBangkokLocal("not a date")).toBe("");
  });
});

describe("formatBangkok", () => {
  it("shows Bangkok wall time with a Thai (Buddhist era) year", () => {
    const text = formatBangkok("2026-10-31T16:30:00Z");
    expect(text).toContain("2569");
    expect(text).toContain("23:30");
  });
  it("returns a dash for invalid input", () => {
    expect(formatBangkok("x")).toBe("-");
  });
});
