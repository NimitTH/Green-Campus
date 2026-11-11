import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormSkeleton } from "@/app/_components/skeletons";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่ | Green Campus" };

// After a staff password reset (DESIGN-4 6.4) every page sends the student here until they set a new
// password. The session read is request-time: keep it behind Suspense (FormSkeleton, ruling R2).
export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<FormSkeleton fields={2} />}>
      <ChangePasswordGate />
    </Suspense>
  );
}

async function ChangePasswordGate() {
  // Anonymous -> /login, suspended -> signed out; the pending flag is allowed on this page only.
  const user = await requireUser("/change-password");
  if (!user.mustChangePassword) redirect(isStaffRole(user.role) ? "/staff" : "/dashboard");
  return <ChangePasswordForm />;
}
