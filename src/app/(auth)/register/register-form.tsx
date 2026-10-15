"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/messages";
import { Alert, Field, FormTitle, SubmitButton } from "../_components/ui";

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, undefined);

  if (state?.message) {
    return (
      <div>
        <FormTitle title="ตรวจอีเมลของคุณ" />
        <Alert kind="success">{state.message}</Alert>
        <p className="text-center text-sm">
          ยืนยันแล้ว?{" "}
          <Link href="/login" className="text-green-700 underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate>
      <FormTitle title="สมัครสมาชิก" subtitle="กรอกชื่อจริงเพื่อให้ครูตรวจผลงานได้ถูกคน" />
      {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
      <Field
        label="ชื่อ-นามสกุลจริง"
        name="fullName"
        autoComplete="name"
        defaultValue={state?.values?.fullName}
        error={state?.fieldErrors?.fullName}
      />
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
        autoComplete="new-password"
        hint={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
        error={state?.fieldErrors?.password}
      />
      <Field
        label="ยืนยันรหัสผ่าน"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={state?.fieldErrors?.confirmPassword}
      />
      <SubmitButton pending={pending}>สมัครสมาชิก</SubmitButton>
      <p className="mt-4 text-center text-sm">
        มีบัญชีแล้ว?{" "}
        <Link href="/login" className="text-green-700 underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
