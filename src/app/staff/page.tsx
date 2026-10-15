import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth/dal";
import { PageSkeleton } from "../_components/page-skeleton";
import { SignOutButton } from "../_components/sign-out-button";

export const metadata: Metadata = { title: "ครูและผู้ดูแล | Green Campus" };

export default function StaffPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <Suspense fallback={<PageSkeleton />}>
        <StaffHome />
      </Suspense>
    </main>
  );
}

async function StaffHome() {
  const user = await requireStaff();
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{user.role === "admin" ? "ผู้ดูแลระบบ" : "ครู"}</p>
          <h1 className="text-xl font-semibold">{user.displayName || user.fullName}</h1>
        </div>
        <SignOutButton />
      </div>
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีข้อมูล
      </section>
    </>
  );
}
