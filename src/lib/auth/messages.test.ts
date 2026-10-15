import { describe, expect, it } from "vitest";
import {
  LINK_INVALID_MESSAGE,
  authErrorMessage,
  hasErrors,
  validateNewPassword,
  validateSignIn,
  validateSignUp,
} from "./messages";

describe("authErrorMessage", () => {
  it("maps known codes to Thai guidance", () => {
    expect(authErrorMessage("invalid_credentials")).toContain("ลืมรหัสผ่าน");
    expect(authErrorMessage("email_not_confirmed")).toContain("ยืนยันอีเมล");
    expect(authErrorMessage("otp_expired")).toBe(LINK_INVALID_MESSAGE);
  });
  it("has a generic fallback that still says what to do", () => {
    expect(authErrorMessage(undefined)).toContain("ลองใหม่");
    expect(authErrorMessage("something_new")).toContain("ลองใหม่");
  });
});

describe("validateSignUp", () => {
  const ok = { fullName: "สมชาย ใจดี", email: "a@b.co", password: "abcd1234", confirmPassword: "abcd1234" };
  it("accepts valid input", () => {
    expect(hasErrors(validateSignUp(ok))).toBe(false);
  });
  it("requires full name", () => {
    expect(validateSignUp({ ...ok, fullName: "" }).fullName).toBeDefined();
  });
  it("rejects bad email", () => {
    expect(validateSignUp({ ...ok, email: "nope" }).email).toBeDefined();
  });
  it("rejects short password", () => {
    expect(validateSignUp({ ...ok, password: "a1", confirmPassword: "a1" }).password).toBeDefined();
  });
  it("rejects mismatched confirmation", () => {
    expect(validateSignUp({ ...ok, confirmPassword: "different1" }).confirmPassword).toBeDefined();
  });
});

describe("validateSignIn / validateNewPassword", () => {
  it("sign in needs email and password", () => {
    const e = validateSignIn({ email: "", password: "" });
    expect(e.email).toBeDefined();
    expect(e.password).toBeDefined();
  });
  it("new password must match", () => {
    expect(hasErrors(validateNewPassword({ password: "abcd1234", confirmPassword: "abcd1234" }))).toBe(false);
    expect(validateNewPassword({ password: "abcd1234", confirmPassword: "x" }).confirmPassword).toBeDefined();
  });
});
