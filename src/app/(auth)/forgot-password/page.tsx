import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "../_components/ui";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน | Green Campus" };

export default function ForgotPasswordPage() {
  // useSearchParams (error) is request-time: keep it behind Suspense.
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
