import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "../_components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ | Green Campus" };

export default function LoginPage() {
  // useSearchParams (next, error) is request-time: keep it behind Suspense.
  return (
    <Suspense fallback={<FormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
