import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { PageSkeleton } from "../_components/page-skeleton";
import { SignOutButton } from "../_components/sign-out-button";

export const metadata: Metadata = { title: "หน้าหลัก | Green Campus" };

// cacheComponents: the session read happens inside <Suspense> (see Task 3 report).
export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <Suspense fallback={<PageSkeleton />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}

async function DashboardContent() {
  const user = await requireUser("/dashboard");
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">สวัสดี</p>
          <h1 className="text-xl font-semibold">{user.displayName || user.fullName}</h1>
        </div>
        <SignOutButton />
      </div>
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีข้อมูล
      </section>
      {isStaffRole(user.role) ? (
        <p className="mt-6 text-center">
          <Link href="/staff" className="text-green-700 underline">
            ไปหน้าครูและผู้ดูแล
          </Link>
        </p>
      ) : null}
    </>
  );
}
