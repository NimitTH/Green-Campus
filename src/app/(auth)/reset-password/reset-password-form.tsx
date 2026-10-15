"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/messages";
import { Alert, Field, FormTitle, SubmitButton } from "../_components/ui";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <form action={action} noValidate>
      <FormTitle title="ตั้งรหัสผ่านใหม่" subtitle="ตั้งรหัสผ่านใหม่แล้วระบบจะพาเข้าสู่หน้าหลัก" />
      {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
      <Field
        label="รหัสผ่านใหม่"
        name="password"
        type="password"
        autoComplete="new-password"
        hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
        error={state?.fieldErrors?.password}
      />
      <Field
        label="ยืนยันรหัสผ่านใหม่"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={state?.fieldErrors?.confirmPassword}
      />
      <SubmitButton pending={pending}>บันทึกรหัสผ่านใหม่</SubmitButton>
      <p className="mt-4 text-center text-sm">
        ลิงก์หมดอายุ?{" "}
        <Link href="/forgot-password" className="text-green-700 underline">
          ขอลิงก์ใหม่
        </Link>
      </p>
    </form>
  );
}
