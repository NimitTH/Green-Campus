import type { Metadata } from "next";
import Link from "next/link";
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
      <nav aria-label="เมนูครู" className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link
          href="/staff/reviews"
          className="block rounded-2xl border border-gray-200 p-4 font-semibold hover:border-green-600 dark:border-gray-800"
        >
          ตรวจผล
          <span className="block text-sm font-normal text-gray-600 dark:text-gray-400">
            อนุมัติหรือปฏิเสธผลที่นักเรียนส่ง
          </span>
        </Link>
        <Link
          href="/staff/activities"
          className="block rounded-2xl border border-gray-200 p-4 font-semibold hover:border-green-600 dark:border-gray-800"
        >
          จัดการกิจกรรม
          <span className="block text-sm font-normal text-gray-600 dark:text-gray-400">
            สร้าง แก้ไข เปิด/ปิดกิจกรรม
          </span>
        </Link>
        <Link
          href="/staff/weigh-station"
          className="block rounded-2xl border border-gray-200 p-4 font-semibold hover:border-green-600 dark:border-gray-800"
        >
          จุดชั่ง
          <span className="block text-sm font-normal text-gray-600 dark:text-gray-400">
            ออกรหัส 6 หลักให้นักเรียนที่มาชั่ง
          </span>
        </Link>
      </nav>
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีข้อมูล
      </section>
    </>
  );
}
