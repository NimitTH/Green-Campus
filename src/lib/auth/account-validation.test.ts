import { describe, expect, it } from "vitest";
import { authErrorMessage, validateEmail, validatePassword, MIN_PASSWORD_LENGTH } from "./messages";
import { validateEmailChange, validatePasswordChange } from "./account-validation";

describe("validateEmailChange", () => {
  const ok = { newEmail: "new@example.com", currentEmail: "old@example.com", currentPassword: "secret-pass" };
  it("accepts a different, well-formed email with a password", () => {
    expect(validateEmailChange(ok)).toEqual({});
  });
  it("rejects the same email, ignoring case and spaces", () => {
    const errors = validateEmailChange({ ...ok, newEmail: "  OLD@Example.com " });
    expect(errors.newEmail).toBeTruthy();
    expect(errors.currentPassword).toBeUndefined();
  });
  it("rejects a malformed email with the sign-up message", () => {
    expect(validateEmailChange({ ...ok, newEmail: "nope" }).newEmail).toBe(validateEmail("nope"));
    expect(validateEmailChange({ ...ok, newEmail: "" }).newEmail).toBe(validateEmail(""));
  });
  it("requires the current password", () => {
    expect(validateEmailChange({ ...ok, currentPassword: "" }).currentPassword).toBe("กรอกรหัสผ่าน");
  });
});

describe("validatePasswordChange", () => {
  const ok = { currentPassword: "old-password", newPassword: "new-password-1" };
  it("accepts a valid change", () => {
    expect(validatePasswordChange(ok)).toEqual({});
  });
  it("requires the current password", () => {
    expect(validatePasswordChange({ ...ok, currentPassword: "" }).currentPassword).toBe("กรอกรหัสผ่าน");
  });
  it("rejects a short new password with the validatePassword text", () => {
    const short = "x".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validatePasswordChange({ ...ok, newPassword: short }).newPassword).toBe(validatePassword(short));
  });
  it("rejects a new password equal to the current one", () => {
    expect(validatePasswordChange({ currentPassword: "same-password", newPassword: "same-password" }).newPassword).toBe(
      authErrorMessage("same_password"),
    );
  });
});
