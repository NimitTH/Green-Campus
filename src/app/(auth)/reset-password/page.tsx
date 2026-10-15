import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่ | Green Campus" };

// Reached from the email link via /auth/callback, which sets the session cookie.
// The updatePassword action checks the session itself.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
