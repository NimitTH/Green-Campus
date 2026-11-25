import { describe, expect, it } from "vitest";
import { REPORT_MESSAGE_MAX, safeReportPath, validateReportMessage } from "./format";

describe("safeReportPath", () => {
  it("keeps a same-site path with its query", () => {
    expect(safeReportPath("/rewards?q=1")).toBe("/rewards?q=1");
    expect(safeReportPath("/")).toBe("/");
  });
  it("drops anything that could leave the site, and empty input", () => {
    for (const bad of ["//evil.com", "https://evil.com/x", "/\\evil", "/\t/evil.com", "/a\nb", "evil", "", null, undefined]) {
      expect(safeReportPath(bad)).toBeNull();
    }
  });
  it("drops a path longer than 300 characters", () => {
    expect(safeReportPath(`/${"a".repeat(299)}`)).toBe(`/${"a".repeat(299)}`);
    expect(safeReportPath(`/${"a".repeat(300)}`)).toBeNull();
  });
});

describe("validateReportMessage", () => {
  it("trims and accepts a message", () => {
    expect(validateReportMessage("  กดแล้วไม่ไป \n")).toEqual({ ok: true, value: "กดแล้วไม่ไป" });
  });
  it("refuses whitespace only", () => {
    expect(validateReportMessage(" \n\t ").ok).toBe(false);
  });
  it("counts characters, not bytes: 1000 Thai characters pass, 1001 fail", () => {
    expect(validateReportMessage("ก".repeat(REPORT_MESSAGE_MAX)).ok).toBe(true);
    expect(validateReportMessage("ก".repeat(REPORT_MESSAGE_MAX + 1))).toEqual({ ok: false, error: "เขียนได้ไม่เกิน 1,000 ตัวอักษร" });
  });
});
