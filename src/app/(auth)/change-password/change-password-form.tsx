"use client";

import { useActionState } from "react";
import { changeTemporaryPassword, type ChangePasswordState } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/messages";
import { Alert, Field, FormTitle, SubmitButton } from "../_components/ui";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changeTemporaryPassword,
    undefined,
  );

  return (
    <form action={action} noValidate>
      <FormTitle title="ตั้งรหัสผ่านใหม่" />
      {state?.formError ? <Alert kind="error">{state.formError}</Alert> : null}
      <Field
        label="รหัสผ่านใหม่"
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
      <SubmitButton pending={pending}>บันทึกรหัสผ่านใหม่</SubmitButton>
    </form>
  );
}
