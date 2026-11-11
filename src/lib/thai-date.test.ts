import { describe, expect, it } from "vitest";
import { THAI_MONTHS_LONG, formatThaiDate, parseThaiDate } from "./thai-date";

describe("parseThaiDate", () => {
  it("reads dd/mm/BE as a Gregorian ISO date", () => {
    expect(parseThaiDate("06/11/2569")).toBe("2026-11-06");
    expect(parseThaiDate("6/11/2569")).toBe("2026-11-06");
    expect(parseThaiDate(" 06/11/2569 ")).toBe("2026-11-06");
  });
  it("checks real days including leap years", () => {
    expect(parseThaiDate("29/02/2567")).toBe("2024-02-29");
    expect(parseThaiDate("29/02/2568")).toBeNull();
    expect(parseThaiDate("31/04/2569")).toBeNull();
    expect(parseThaiDate("00/01/2569")).toBeNull();
    expect(parseThaiDate("01/13/2569")).toBeNull();
  });
  it("rejects a Gregorian year and garbage", () => {
    expect(parseThaiDate("06/11/2026")).toBeNull();
    expect(parseThaiDate("")).toBeNull();
    expect(parseThaiDate("aa/bb/cccc")).toBeNull();
    expect(parseThaiDate("06-11-2569")).toBeNull();
  });
});

describe("formatThaiDate", () => {
  it("writes dd/mm/BE", () => {
    expect(formatThaiDate("2033-05-10")).toBe("10/05/2576");
    expect(formatThaiDate("2026-11-06")).toBe("06/11/2569");
  });
  it("returns empty for an invalid date", () => {
    expect(formatThaiDate("")).toBe("");
    expect(formatThaiDate("2026-02-30")).toBe("");
    expect(formatThaiDate("nope")).toBe("");
  });
});

describe("THAI_MONTHS_LONG", () => {
  it("has twelve months", () => {
    expect(THAI_MONTHS_LONG).toHaveLength(12);
    expect(THAI_MONTHS_LONG[10]).toBe("พฤศจิกายน");
  });
});
