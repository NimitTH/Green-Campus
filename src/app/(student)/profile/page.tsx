import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { SignOutButton } from "@/app/_components/sign-out-button";
import { ROLE_LABEL_TH } from "@/lib/admin/validation";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "โปรไฟล์ | Green Campus" };

// cacheComponents: the session is request-time data, read it inside <Suspense>.
export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">โปรไฟล์ของฉัน</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const user = await requireUser("/profile");
  return (
    <>
      {isStaffRole(user.role) ? (
        <p className="mb-4">
          <Link href="/staff" className="text-sm text-green-700 underline">
            ← กลับหน้าครูและผู้ดูแล
          </Link>
        </p>
      ) : null}
      <dl className="mb-6 grid gap-3 rounded-2xl border border-gray-200 p-4 text-sm sm:grid-cols-2 dark:border-gray-800">
        <div>
          <dt className="text-gray-600 dark:text-gray-400">บทบาท</dt>
          <dd data-testid="profile-role" className="font-medium">
            {ROLE_LABEL_TH[user.role]}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-600 dark:text-gray-400">อีเมล</dt>
          <dd data-testid="profile-email" className="font-medium break-all">
            {user.email ?? "-"}
          </dd>
        </div>
      </dl>
      <ProfileForm initial={{ fullName: user.fullName, displayName: user.displayName ?? "" }} />
      <div className="mt-8">
        <SignOutButton />
      </div>
    </>
  );
}
