import { describe, expect, it } from "vitest";
import { GOOGLE_CALLBACK_PATH, OAUTH_NEXT_COOKIE, OAUTH_NEXT_MAX_AGE, googleCallbackTarget, isGoogleAuthEnabled } from "./google";
import { GOOGLE_FAILED_MESSAGE, loginErrorMessage } from "./messages";

describe("googleCallbackTarget", () => {
  it("a failed or missing exchange goes to the login page with the Google message", () => {
    expect(googleCallbackTarget({ exchanged: false, suspended: false, next: "/rewards" })).toBe("/login?error=google");
  });
  it("a suspended account goes to the login page with the suspended message", () => {
    expect(googleCallbackTarget({ exchanged: true, suspended: true, next: "/rewards" })).toBe("/login?error=suspended");
  });
  it("otherwise the safe next path, /dashboard by default", () => {
    expect(googleCallbackTarget({ exchanged: true, suspended: false, next: "/rewards?q=1" })).toBe("/rewards?q=1");
    for (const next of ["//evil.com", "https://evil.com", undefined, ""]) {
      expect(googleCallbackTarget({ exchanged: true, suspended: false, next })).toBe("/dashboard");
    }
  });
});

describe("isGoogleAuthEnabled", () => {
  it("is on only for the exact value on", () => {
    expect(isGoogleAuthEnabled("on")).toBe(true);
    for (const v of ["1", "true", "", " on", undefined]) expect(isGoogleAuthEnabled(v)).toBe(false);
  });
});

describe("constants", () => {
  it("match the design", () => {
    expect(OAUTH_NEXT_COOKIE).toBe("gc_oauth_next");
    expect(OAUTH_NEXT_MAX_AGE).toBe(600);
    expect(GOOGLE_CALLBACK_PATH).toBe("/auth/callback/google");
  });
});

describe("loginErrorMessage google", () => {
  it("has its own message, not the e-mail link one", () => {
    expect(GOOGLE_FAILED_MESSAGE).toBe("เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง");
    expect(loginErrorMessage("google")).toBe(GOOGLE_FAILED_MESSAGE);
  });
});
