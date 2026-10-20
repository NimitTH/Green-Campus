import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { RewardImage } from "@/app/_components/reward-image";
import { requireStaff } from "@/lib/auth/dal";
import { listRewardsForStaff } from "@/lib/rewards/queries";
import { ActiveToggle } from "./_components/active-toggle";

export const metadata: Metadata = { title: "จัดการของรางวัล | Green Campus" };

export default function StaffRewardsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">จัดการของรางวัล</h1>
        <Link
          href="/staff/rewards/new"
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          เพิ่มของรางวัล
        </Link>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <RewardList />
      </Suspense>
    </main>
  );
}

const number = new Intl.NumberFormat("th-TH");

async function RewardList() {
  await requireStaff("/staff/rewards");
  const rewards = await listRewardsForStaff();

  if (rewards.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีของรางวัล กด &quot;เพิ่มของรางวัล&quot; เพื่อเริ่ม
      </section>
    );
  }

  return (
    <ul className="space-y-3">
      {rewards.map((r) => (
        <li key={r.id} data-testid="staff-reward" className="flex gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <RewardImage url={r.imageUrl} className="h-20 w-20 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold break-words">{r.name}</h2>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge tone={r.active ? "green" : "gray"}>{r.active ? "เปิดอยู่" : "ปิดการแลก"}</Badge>
                  {r.stock === 0 ? <Badge tone="amber">หมดแล้ว</Badge> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Link
                  href={`/staff/rewards/${r.id}/edit`}
                  aria-label={`แก้ไข ${r.name}`}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
                >
                  แก้ไข
                </Link>
                <ActiveToggle rewardId={r.id} name={r.name} active={r.active} />
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {number.format(r.points_cost)} แต้ม · สต็อก {number.format(r.stock)} ชิ้น
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
