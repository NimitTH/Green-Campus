import { describe, expect, it } from "vitest";
import { NAME_LIMITS, previewDisplayName, validateFullName, validateProfile } from "./validation";

describe("validateProfile", () => {
  it("accepts names and collapses whitespace", () => {
    expect(validateProfile({ fullName: "  สมชาย \n ใจดี ", displayName: " ฮีโร่\tรักษ์โลก " })).toEqual({
      ok: true,
      value: { full_name: "สมชาย ใจดี", display_name: "ฮีโร่ รักษ์โลก" },
    });
  });
  it("turns a blank display name into null", () => {
    const r = validateProfile({ fullName: "สมชาย", displayName: " \n\t " });
    expect(r.ok && r.value.display_name).toBeNull();
  });
  it("requires a full name (whitespace only counts as blank)", () => {
    const r = validateProfile({ fullName: "\t\n ", displayName: "" });
    expect(!r.ok && r.fieldErrors.fullName).toBe("กรอกชื่อ-นามสกุลจริง");
  });
  it("limits the full name to 100 and the display name to 50 characters", () => {
    expect(NAME_LIMITS).toEqual({ fullNameMax: 100, displayNameMax: 50 });
    const long = validateProfile({ fullName: "ก".repeat(101), displayName: "ข".repeat(51) });
    expect(!long.ok && long.fieldErrors.fullName).toBe("ชื่อ-นามสกุลยาวได้ไม่เกิน 100 ตัวอักษร");
    expect(!long.ok && long.fieldErrors.displayName).toBe("ชื่อที่แสดงยาวได้ไม่เกิน 50 ตัวอักษร");
    expect(validateProfile({ fullName: "ก".repeat(100), displayName: "ข".repeat(50) }).ok).toBe(true);
  });
  it("counts characters like Postgres char_length (code points)", () => {
    // 50 emoji are 100 UTF-16 units but 50 characters
    expect(validateProfile({ fullName: "ก", displayName: "🌱".repeat(50) }).ok).toBe(true);
    expect(validateProfile({ fullName: "ก", displayName: "🌱".repeat(51) }).ok).toBe(false);
  });
});

describe("validateFullName (sign-up and profile)", () => {
  it("shares the limits", () => {
    expect(validateFullName("")).toBe("กรอกชื่อ-นามสกุลจริง");
    expect(validateFullName("ก".repeat(101))).toBe("ชื่อ-นามสกุลยาวได้ไม่เกิน 100 ตัวอักษร");
    expect(validateFullName("ก".repeat(100))).toBeUndefined();
  });
});

describe("previewDisplayName (profile_display_name rule)", () => {
  it.each([
    ["ฮีโร่", "สมชาย ใจดี", "ฮีโร่"],
    [" ฮีโร่ ", "สมชาย", "ฮีโร่"],
    ["", "สมชาย ใจดี", "สมชาย ใจดี"],
    ["\n", "สมชาย", "สมชาย"],
    ["\t ", "\n", "ไม่ระบุชื่อ"],
    [null, "", "ไม่ระบุชื่อ"],
  ])("(%j, %j) -> %s", (display, full, expected) => {
    expect(previewDisplayName(display, full)).toBe(expected);
  });
});
