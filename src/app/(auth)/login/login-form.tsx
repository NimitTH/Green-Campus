"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/lib/auth/actions";
import { LINK_INVALID_MESSAGE } from "@/lib/auth/messages";
import { GoogleButton } from "../_components/google-button";
import { Alert, Field, FormTitle, OrDivider, SubmitButton } from "../_components/ui";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const linkError = searchParams.get("error") === "link";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, undefined);

  return (
    <form action={action} noValidate>
      <FormTitle title="เข้าสู่ระบบ" subtitle="เข้าสู่ระบบเพื่อร่วมกิจกรรม ส่งผล และสะสมแต้มแลกรางวัล" />
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
        labelAction={
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">
            ลืมรหัสผ่าน?
          </Link>
        }
        error={state?.fieldErrors?.password}
      />
      <SubmitButton pending={pending}>เข้าสู่ระบบ</SubmitButton>
      <OrDivider />
      <GoogleButton label="เข้าสู่ระบบด้วย Google" />
      <p className="mt-4 text-center text-sm">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">
          สมัครสมาชิก
        </Link>
      </p>
    </form>
  );
}
