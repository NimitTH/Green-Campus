"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import {
  authErrorMessage,
  hasErrors,
  validateEmail,
  validateNewPassword,
  validateSignIn,
  validateSignUp,
  type FieldErrors,
} from "./messages";
import { safeNextPath } from "./routes";

export type AuthFormState =
  | {
      error?: string;
      fieldErrors?: FieldErrors;
      message?: string;
      values?: { email?: string; fullName?: string };
    }
  | undefined;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function rawText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").toLowerCase();
  const password = rawText(formData, "password");
  const next = safeNextPath(text(formData, "next"));

  const fieldErrors = validateSignIn({ email, password });
  if (hasErrors(fieldErrors)) return { fieldErrors, values: { email } };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.code), values: { email } };

  redirect(next);
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = text(formData, "fullName").replace(/\s+/g, " ");
  const email = text(formData, "email").toLowerCase();
  const password = rawText(formData, "password");
  const confirmPassword = rawText(formData, "confirmPassword");
  const values = { email, fullName };

  const fieldErrors = validateSignUp({ fullName, email, password, confirmPassword });
  if (hasErrors(fieldErrors)) return { fieldErrors, values };

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { error: authErrorMessage(error.code), values };

  // Email confirmation turned off (spec 8.6 fallback): already signed in.
  if (data.session) redirect("/dashboard");

  return {
    message: `ส่งอีเมลยืนยันไปที่ ${email} แล้ว เปิดอีเมลแล้วกดลิงก์ยืนยันเพื่อเข้าสู่ระบบ (ถ้าไม่เห็น ให้ดูในโฟลเดอร์ Spam)`,
    values,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email").toLowerCase();
  const emailError = validateEmail(email);
  if (emailError) return { fieldErrors: { email: emailError }, values: { email } };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: authErrorMessage(error.code), values: { email } };
  }

  // Same answer whether or not the address has an account.
  return {
    message: `ถ้า ${email} มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว เปิดอีเมลแล้วกดลิงก์ในเบราว์เซอร์นี้ (ถ้าไม่เห็น ให้ดูในโฟลเดอร์ Spam)`,
    values: { email },
  };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = rawText(formData, "password");
  const confirmPassword = rawText(formData, "confirmPassword");

  const fieldErrors = validateNewPassword({ password, confirmPassword });
  if (hasErrors(fieldErrors)) return { fieldErrors };

  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      error:
        "ลิงก์ตั้งรหัสผ่านใหม่หมดอายุแล้ว ไปที่หน้า “ลืมรหัสผ่าน” เพื่อขอลิงก์ใหม่ แล้วเปิดลิงก์ในเบราว์เซอร์นี้",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error.code) };

  redirect("/dashboard");
}
