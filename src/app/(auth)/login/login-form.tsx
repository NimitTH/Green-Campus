"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/lib/auth/actions";
import { LINK_INVALID_MESSAGE } from "@/lib/auth/messages";
import { Alert, Field, FormTitle, SubmitButton } from "../_components/ui";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const linkError = searchParams.get("error") === "link";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, undefined);

  return (
    <form action={action} noValidate>
      <FormTitle title="เข้าสู่ระบบ" subtitle="ใช้อีเมลและรหัสผ่านที่สมัครไว้" />
      {linkError && !state ? <Alert kind="error">{LINK_INVALID_MESSAGE}</Alert> : null}
      {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <Field
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state?.values?.email}
        error={state?.fieldErrors?.email}
      />
      <Field
        label="รหัสผ่าน"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state?.fieldErrors?.password}
      />
      <div className="mb-4 text-right text-sm">
        <Link href="/forgot-password" className="text-green-700 underline">
          ลืมรหัสผ่าน?
        </Link>
      </div>
      <SubmitButton pending={pending}>เข้าสู่ระบบ</SubmitButton>
      <p className="mt-4 text-center text-sm">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="text-green-700 underline">
          สมัครสมาชิก
        </Link>
      </p>
    </form>
  );
}
