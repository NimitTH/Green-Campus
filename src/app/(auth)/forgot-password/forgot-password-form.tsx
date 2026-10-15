"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/lib/auth/actions";
import { RESET_LINK_INVALID_MESSAGE } from "@/lib/auth/messages";
import { Alert, Field, FormTitle, SubmitButton } from "../_components/ui";

export function ForgotPasswordForm() {
  const linkError = useSearchParams().get("error") === "link";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <form action={action} noValidate>
      <FormTitle title="ลืมรหัสผ่าน" subtitle="กรอกอีเมลที่สมัครไว้ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้" />
      {linkError && !state ? <Alert kind="error">{RESET_LINK_INVALID_MESSAGE}</Alert> : null}
      {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state?.message ? <Alert kind="success">{state.message}</Alert> : null}
      <Field
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email}
        error={state?.fieldErrors?.email}
      />
      <SubmitButton pending={pending}>ส่งลิงก์ตั้งรหัสผ่านใหม่</SubmitButton>
      <p className="mt-4 text-center text-sm">
        จำรหัสได้แล้ว?{" "}
        <Link href="/login" className="text-green-700 underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
