import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { previewDisplayName } from "@/lib/profile/validation";
import { buttonClass } from "@/components/ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { RankCard } from "./_components/rank-card";
import { StudentStats } from "./_components/student-stats";

export const metadata: Metadata = { title: "หน้าหลัก | Green Campus" };

const cardClass =
  "block rounded-card border border-rule bg-surface p-4 font-semibold break-words text-ink shadow-sheet transition-colors hover:border-accent";

// Hub for the pages that are not in the bottom nav (spec 9.2). Sign out lives on /profile ("ฉัน").
const HUB = [
  { href: "/activities", label: "กิจกรรม", hint: "ดูกิจกรรมที่เปิดรับและกดเข้าร่วม" },
  { href: "/rewards", label: "รางวัล", hint: "แลกแต้มเป็นของรางวัล" },
  { href: "/orders", label: "ออเดอร์", hint: "ออเดอร์และใบเสร็จของฉัน" },
  { href: "/my-submissions", label: "ผลที่ส่ง", hint: "สถานะผลกิจกรรมที่ส่ง" },
  { href: "/leaderboard", label: "อันดับ", hint: "อันดับคาร์บอนรายเดือนและตลอดกาล" },
  { href: "/articles", label: "บทความ", hint: "ความรู้เรื่องขยะและสิ่งแวดล้อม" },
  { href: "/profile", label: "โปรไฟล์", hint: "แก้ชื่อและชื่อที่แสดง" },
] as const;

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
      <div className="mb-6">
        <p className="text-sm text-muted">สวัสดี</p>
        <h1 className="font-display text-[clamp(1.75rem,2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">{previewDisplayName(user.displayName, user.fullName)}</h1>
      </div>
      <nav aria-label="เมนูนักเรียน" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {HUB.map((m) => (
          <Link key={m.href} href={m.href} className={cardClass}>
            {m.label}
            <span className="block text-sm font-normal text-muted">{m.hint}</span>
          </Link>
        ))}
      </nav>
      {isStaffRole(user.role) ? (
        <p className="text-center">
          <Link href="/staff" className={buttonClass({ variant: "primary", size: "lg" })}>
            ไปหน้าครูและผู้ดูแล
          </Link>
        </p>
      ) : (
        <>
          <Suspense fallback={null}>
            <RankCard />
          </Suspense>
          <StudentStats studentId={user.id} />
        </>
      )}
    </>
  );
}
