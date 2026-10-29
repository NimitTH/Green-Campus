import { authErrorMessage, validateEmail, validatePassword } from "./messages";

const NEED_PASSWORD = "กรอกรหัสผ่าน";

function compact<T extends Record<string, string | undefined>>(errors: T): Partial<Record<keyof T, string>> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v !== undefined)) as Partial<Record<keyof T, string>>;
}

/** Field errors for changing the sign-in email from the profile page. */
export function validateEmailChange(input: {
  newEmail: string;
  currentEmail: string;
  currentPassword: string;
}): Partial<Record<"newEmail" | "currentPassword", string>> {
  const newEmail = input.newEmail.trim().toLowerCase();
  let newEmailError = validateEmail(newEmail);
  if (!newEmailError && newEmail === input.currentEmail.trim().toLowerCase()) {
    newEmailError = "อีเมลใหม่ต้องไม่ซ้ำกับอีเมลปัจจุบัน";
  }
  return compact({
    newEmail: newEmailError,
    currentPassword: input.currentPassword ? undefined : NEED_PASSWORD,
  });
}

/** Field errors for changing the password from the profile page. */
export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
}): Partial<Record<"currentPassword" | "newPassword", string>> {
  let newPasswordError = validatePassword(input.newPassword);
  if (!newPasswordError && input.currentPassword && input.newPassword === input.currentPassword) {
    newPasswordError = authErrorMessage("same_password");
  }
  return compact({
    currentPassword: input.currentPassword ? undefined : NEED_PASSWORD,
    newPassword: newPasswordError,
  });
}

export type PasswordCheck = "ok" | "wrong" | "error";

/** Only a real invalid-credentials answer means a wrong password; rate limits, timeouts and 5xx are "error". */
export function classifySignInResult(error: { code?: string; status?: number } | null | undefined): PasswordCheck {
  if (!error) return "ok";
  return error.code === "invalid_credentials" ? "wrong" : "error";
}
