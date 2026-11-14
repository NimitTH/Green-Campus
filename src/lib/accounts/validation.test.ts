import { describe, expect, it } from "vitest";
import {
  SUSPEND_REASON_MAX,
  banDurationFor,
  confirmNameMatches,
  isSuspendInput,
  needsUnsuspendRetry,
  showUnsuspendButton,
  validateSuspend,
  type SuspendInput,
} from "./validation";

const base: SuspendInput = { duration: "1", customDays: "", reason: "ทิ้งขยะผิดที่ซ้ำ" };

describe("validateSuspend", () => {
  it.each([
    ["1", 1],
    ["3", 3],
    ["7", 7],
    ["30", 30],
  ] as const)("preset %s days", (duration, days) => {
    expect(validateSuspend({ ...base, duration })).toEqual({ ok: true, days, reason: base.reason });
  });

  it("custom 365 -> days 365; 1 is the minimum", () => {
    expect(validateSuspend({ ...base, duration: "custom", customDays: "365" })).toEqual({ ok: true, days: 365, reason: base.reason });
    expect(validateSuspend({ ...base, duration: "custom", customDays: " 1 " })).toEqual({ ok: true, days: 1, reason: base.reason });
  });

  it.each(["0", "366", "abc", "", "1.5", "-3", "1e2"])("custom %j -> a customDays error", (customDays) => {
    const r = validateSuspend({ ...base, duration: "custom", customDays });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.customDays).toBeTruthy();
  });

  it("forever -> days null", () => {
    expect(validateSuspend({ ...base, duration: "forever" })).toEqual({ ok: true, days: null, reason: base.reason });
  });

  it("empty or blank reason -> a reason error", () => {
    for (const reason of ["", "   \n "]) {
      const r = validateSuspend({ ...base, reason });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors.reason).toBeTruthy();
    }
  });

  it("reason of 500 characters is fine, 501 is an error; the reason is trimmed", () => {
    expect(SUSPEND_REASON_MAX).toBe(500);
    expect(validateSuspend({ ...base, reason: "ก".repeat(500) }).ok).toBe(true);
    const r = validateSuspend({ ...base, reason: "ก".repeat(501) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.reason).toBeTruthy();
    expect(validateSuspend({ ...base, reason: "  เหตุผล  " })).toEqual({ ok: true, days: 1, reason: "เหตุผล" });
  });

  it("an unknown duration -> a duration error", () => {
    const r = validateSuspend({ ...base, duration: "2" as SuspendInput["duration"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.duration).toBeTruthy();
  });
});

describe("isSuspendInput", () => {
  it("accepts the three string fields only", () => {
    expect(isSuspendInput(base)).toBe(true);
    expect(isSuspendInput({ ...base, customDays: 3 })).toBe(false);
    expect(isSuspendInput(null)).toBe(false);
    expect(isSuspendInput("x")).toBe(false);
  });
});

describe("confirmNameMatches", () => {
  it("matches the full name exactly after trimming the typed text", () => {
    expect(confirmNameMatches("สมชาย ใจดี", "สมชาย ใจดี")).toBe(true);
    expect(confirmNameMatches("  สมชาย ใจดี \n", "สมชาย ใจดี")).toBe(true);
  });
  it("is exact otherwise (case, inner spaces, partial)", () => {
    expect(confirmNameMatches("สมชาย  ใจดี", "สมชาย ใจดี")).toBe(false);
    expect(confirmNameMatches("สมชาย", "สมชาย ใจดี")).toBe(false);
    expect(confirmNameMatches("Somchai", "somchai")).toBe(false);
    expect(confirmNameMatches("", "")).toBe(false);
  });
});

describe("banDurationFor", () => {
  it("days*24 hours, or 876000h until lifted", () => {
    expect(banDurationFor(1)).toBe("24h");
    expect(banDurationFor(365)).toBe("8760h");
    expect(banDurationFor(null)).toBe("876000h");
  });
});

describe("unsuspend retry (review I1)", () => {
  it("offers ยกเลิกระงับ again only when the Auth step failed after the database step", () => {
    expect(needsUnsuspendRetry({ ok: false, error: "x", retry: true })).toBe(true);
    expect(needsUnsuspendRetry({ ok: false, error: "เฉพาะครู" })).toBe(false);
    expect(needsUnsuspendRetry({ ok: true })).toBe(false);
  });
  it("the button shows while suspended or while a retry is pending", () => {
    expect(showUnsuspendButton(true, false)).toBe(true);
    expect(showUnsuspendButton(false, true)).toBe(true);
    expect(showUnsuspendButton(false, false)).toBe(false);
  });
});
