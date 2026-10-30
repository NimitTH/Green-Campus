import { describe, expect, it } from "vitest";
import { greetingFor, greetingName } from "./greeting";

// Bangkok is UTC+7, so 05:00 BKK = 22:00Z the day before.
const bkk = (hhmm: string) => new Date(`2026-10-29T${hhmm}:00+07:00`);

describe("greetingFor (Asia/Bangkok)", () => {
  it.each([
    ["2026-10-29T21:59:00Z", "สวัสดีตอนเย็น"], // 04:59 BKK
    ["2026-10-29T22:00:00Z", "สวัสดีตอนเช้า"], // 05:00
    ["10:59", "สวัสดีตอนเช้า"],
    ["11:00", "สวัสดีตอนเที่ยง"],
    ["12:59", "สวัสดีตอนเที่ยง"],
    ["13:00", "สวัสดีตอนบ่าย"],
    ["16:59", "สวัสดีตอนบ่าย"],
    ["17:00", "สวัสดีตอนเย็น"],
    ["23:30", "สวัสดีตอนเย็น"],
  ])("%s -> %s", (at, expected) => {
    const d = at.includes("T") ? new Date(at) : bkk(at);
    expect(greetingFor(d)).toBe(expected);
  });
});

describe("greetingName", () => {
  it("prefers the display name", () => {
    expect(greetingName({ displayName: "มานี", fullName: "มานี ใจดี" })).toBe("มานี");
  });
  it("falls back to the first word of the full name", () => {
    expect(greetingName({ displayName: null, fullName: "สมชาย ใจกล้า" })).toBe("สมชาย");
  });
  it("treats a blank display name as missing", () => {
    expect(greetingName({ displayName: "  ", fullName: "A B" })).toBe("A");
  });
});
