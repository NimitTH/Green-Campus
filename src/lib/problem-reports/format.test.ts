import { describe, expect, it } from "vitest";
import { REPORT_MESSAGE_MAX, reportErrorFromDb, reportLinkHref, safeReportPath, validateReportMessage } from "./format";

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

describe("reportErrorFromDb (final review I1)", () => {
  it("names the limit, the rolling 24 hours, and does not say try again now", () => {
    expect(reportErrorFromDb({ message: "too_many_reports" }, "submit")).toEqual({ error: "แจ้งปัญหาครบ 5 ครั้งใน 24 ชั่วโมงแล้ว ลองใหม่ภายหลัง" });
  });
  it("tells a demo account it cannot report, and a demo admin it cannot close a real report", () => {
    expect(reportErrorFromDb({ message: "demo_scope" }, "submit")).toEqual({ error: "บัญชีสาธิตแจ้งปัญหาไม่ได้" });
    expect(reportErrorFromDb({ message: "demo_scope" }, "resolve")).toEqual({ error: "บัญชีสาธิตจัดการได้เฉพาะเรื่องที่บัญชีสาธิตแจ้ง" });
  });
  it("maps invalid_input on submit to the message field", () => {
    expect(reportErrorFromDb({ message: "invalid_input" }, "submit")).toEqual({ fieldError: "ตรวจข้อความอีกครั้ง" });
  });
  it("maps report_not_found and the shared codes", () => {
    expect(reportErrorFromDb({ message: "report_not_found" }, "resolve")).toEqual({ error: "ไม่พบเรื่องที่แจ้งนี้ รีเฟรชหน้าเพื่อดูรายการล่าสุด" });
    expect(reportErrorFromDb({ message: "not_admin" }, "resolve")).toEqual({ error: "เฉพาะผู้ดูแลระบบเท่านั้นที่ทำรายการนี้ได้" });
  });
  it("is null for an unknown error (the caller logs it and shows the generic message)", () => {
    expect(reportErrorFromDb({ message: "connection reset" }, "submit")).toBeNull();
  });
});

describe("validateReportMessage line breaks and NUL (final review M4)", () => {
  it("counts a CRLF line break as one character, as the user sees it, and stores LF", () => {
    const text = `${"ก".repeat(499)}\r\n${"ข".repeat(500)}`; // 1000 visible characters with the line break
    expect(validateReportMessage(text)).toEqual({ ok: true, value: `${"ก".repeat(499)}\n${"ข".repeat(500)}` });
  });
  it("refuses a NUL character with a field message instead of a database error", () => {
    expect(validateReportMessage("ปัญหา\u0000")).toEqual({ ok: false, error: "ข้อความมีอักขระที่ใช้ไม่ได้" });
  });
});

describe("reportLinkHref (final review M3)", () => {
  it("links a clean same-site path", () => {
    expect(reportLinkHref("/rewards?q=1")).toBe("/rewards?q=1");
  });
  it("does not link a stored path with dot segments or anything safeReportPath would change", () => {
    for (const bad of ["/.//evil.com", "/a/..//evil.com", "/a/../b", "//evil.com"]) expect(reportLinkHref(bad)).toBeNull();
  });
});
