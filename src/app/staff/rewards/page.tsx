import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { RewardImage } from "@/app/_components/reward-image";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { Mono } from "@/app/staff/reviews/[id]/mono";
import { listRewardsForStaff } from "@/lib/rewards/queries";
import { ActiveToggle } from "./_components/active-toggle";

export const metadata: Metadata = { title: "จัดการของรางวัล | Green Campus" };

export default function StaffRewardsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="จัดการของรางวัล"
          actions={
            <ButtonLink href="/staff/rewards/new" variant="primary">
              เพิ่มของรางวัล
            </ButtonLink>
          }
        />
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
      <EmptyState>ยังไม่มีของรางวัล กด &quot;เพิ่มของรางวัล&quot; เพื่อเริ่ม</EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {rewards.map((r) => (
        <Card as="li" key={r.id} data-testid="staff-reward" className="flex gap-3">
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
                <ButtonLink href={`/staff/rewards/${r.id}/edit`} aria-label={`แก้ไข ${r.name}`} variant="card">
                  แก้ไข
                </ButtonLink>
                <ActiveToggle rewardId={r.id} name={r.name} active={r.active} />
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">
              <Mono text={number.format(r.points_cost)} /> แต้ม · สต็อก <Mono text={number.format(r.stock)} /> ชิ้น
            </p>
          </div>
        </Card>
      ))}
    </ul>
  );
}
