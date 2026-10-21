// Thai messages for auth forms. Each one says what to do next (spec 9).

import { validateFullName } from "@/lib/profile/validation";

export const MIN_PASSWORD_LENGTH = 8;

export type AuthField = "fullName" | "email" | "password" | "confirmPassword";
export type FieldErrors = Partial<Record<AuthField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LINK_INVALID_MESSAGE =
  "ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว ถ้าเพิ่งยืนยันอีเมล ลองเข้าสู่ระบบได้เลย หรือขอลิงก์ใหม่อีกครั้ง (เปิดลิงก์ในเบราว์เซอร์เดียวกับที่ใช้สมัคร)";

export const RESET_LINK_INVALID_MESSAGE =
  "ลิงก์ตั้งรหัสผ่านใหม่หมดอายุหรือถูกใช้ไปแล้ว กรอกอีเมลด้านล่างเพื่อขอลิงก์ใหม่ แล้วเปิดลิงก์ในเบราว์เซอร์นี้";

export function authErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง ตรวจสอบแล้วลองอีกครั้ง หรือกด “ลืมรหัสผ่าน”";
    case "email_not_confirmed":
      return "ยังไม่ได้ยืนยันอีเมล เปิดอีเมลที่เราส่งไปแล้วกดลิงก์ยืนยันก่อนเข้าสู่ระบบ";
    case "user_already_exists":
    case "email_exists":
      return "อีเมลนี้สมัครไว้แล้ว ไปที่หน้าเข้าสู่ระบบ หรือกด “ลืมรหัสผ่าน” ถ้าจำรหัสไม่ได้";
    case "weak_password":
      return `รหัสผ่านง่ายเกินไป ตั้งอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร ผสมตัวอักษรและตัวเลข`;
    case "same_password":
      return "รหัสผ่านใหม่ซ้ำกับรหัสเดิม ตั้งรหัสใหม่ที่ไม่เหมือนเดิม";
    case "email_address_invalid":
      return "อีเมลนี้ใช้ไม่ได้ ตรวจสอบการสะกดหรือใช้อีเมลอื่น";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "ส่งคำขอบ่อยเกินไป รอสักครู่ (ประมาณ 1 นาที) แล้วลองใหม่";
    case "signup_disabled":
    case "email_provider_disabled":
      return "ตอนนี้ปิดรับสมัครชั่วคราว ติดต่อครูผู้ดูแลระบบ";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "การเข้าสู่ระบบหมดอายุ เข้าสู่ระบบใหม่อีกครั้ง";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return LINK_INVALID_MESSAGE;
    default:
      return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้แจ้งครูผู้ดูแลระบบ";
  }
}

export function validateEmail(email: string): string | undefined {
  if (!email) return "กรอกอีเมล";
  if (!EMAIL_RE.test(email)) return "รูปแบบอีเมลไม่ถูกต้อง ตัวอย่าง: name@example.com";
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "กรอกรหัสผ่าน";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
  }
  return undefined;
}

function validateConfirm(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) return "กรอกรหัสผ่านอีกครั้งเพื่อยืนยัน";
  if (password !== confirmPassword) return "รหัสผ่านสองช่องไม่ตรงกัน พิมพ์ใหม่ให้เหมือนกัน";
  return undefined;
}

function compact(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([, v]) => v !== undefined),
  ) as FieldErrors;
}

export function validateSignIn(input: { email: string; password: string }): FieldErrors {
  return compact({
    email: validateEmail(input.email),
    password: input.password ? undefined : "กรอกรหัสผ่าน",
  });
}

export function validateSignUp(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FieldErrors {
  return compact({
    // same limits as /profile; handle_new_user still clips to 100 as a backstop (0019/0021)
    fullName: validateFullName(input.fullName),
    email: validateEmail(input.email),
    password: validatePassword(input.password),
    confirmPassword: validateConfirm(input.password, input.confirmPassword),
  });
}

export function validateNewPassword(input: {
  password: string;
  confirmPassword: string;
}): FieldErrors {
  return compact({
    password: validatePassword(input.password),
    confirmPassword: validateConfirm(input.password, input.confirmPassword),
  });
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
