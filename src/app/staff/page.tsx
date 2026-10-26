import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { previewDisplayName } from "@/lib/profile/validation";
import { PageSkeleton } from "../_components/page-skeleton";
import { StaffStats } from "./_components/staff-stats";

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

const linkClass =
  "block rounded-card border border-rule bg-surface p-4 font-semibold text-ink shadow-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:p-5";
const hintClass = "block text-sm font-normal text-muted";

const MENU = [
  { href: "/staff/reviews", label: "ตรวจผล", hint: "อนุมัติหรือปฏิเสธผลที่นักเรียนส่ง" },
  { href: "/staff/activities", label: "จัดการกิจกรรม", hint: "สร้าง แก้ไข เปิด/ปิดกิจกรรม" },
  { href: "/staff/weigh-station", label: "จุดชั่ง", hint: "ออกรหัส 6 หลักให้นักเรียนที่มาชั่ง" },
  { href: "/staff/orders", label: "ออเดอร์", hint: "ยืนยันรับของ หรือยกเลิกออเดอร์ที่รอรับ" },
  { href: "/staff/rewards", label: "ของรางวัล", hint: "เพิ่ม แก้ไข สต็อก และเปิด/ปิดการแลก" },
  { href: "/staff/articles", label: "บทความ", hint: "เขียน แก้ไข และเผยแพร่บทความความรู้" },
  { href: "/staff/profile", label: "โปรไฟล์", hint: "แก้ชื่อและชื่อที่แสดง" },
  { href: "/staff/reports", label: "รายงาน", hint: "สรุปรายกิจกรรมและรายนักเรียน ดาวน์โหลด CSV/PDF" },
] as const;

// Spec 9.3: /staff/users and /staff/rates are admin only (the pages check again, requireAdmin).
const ADMIN_MENU = [
  { href: "/staff/users", label: "จัดการผู้ใช้", hint: "เปลี่ยนบทบาท และปรับแต้มนักเรียน" },
  { href: "/staff/rates", label: "อัตราแต้มและ carbon", hint: "แก้ชื่อกลุ่มขยะ แต้มต่อกิโลกรัม และค่า carbon" },
] as const;

async function StaffHome() {
  const user = await requireStaff();
  const menu = isAdminRole(user.role) ? [...MENU, ...ADMIN_MENU] : MENU;
  return (
    <>
      <div className="mb-6">
        <p className="mb-1 text-sm text-muted">{user.role === "admin" ? "ผู้ดูแลระบบ" : "ครู"}</p>
        <PageHeader title={previewDisplayName(user.displayName, user.fullName)} />
      </div>
      <Suspense fallback={<div aria-hidden="true" className="mb-6 h-40 animate-pulse rounded-card bg-paper-2" />}>
        <StaffStats />
      </Suspense>
      <nav aria-label="เมนูครู" className="mb-4 grid gap-3 sm:grid-cols-2">
        {menu.map((m) => (
          <Link key={m.href} href={m.href} className={linkClass}>
            {m.label}
            <span className={hintClass}>{m.hint}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
