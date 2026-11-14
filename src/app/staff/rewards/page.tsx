import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { RewardImage } from "@/app/_components/reward-image";
import { ButtonLink, Card, EmptyState, PageHeader, Mono } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { STAFF_REWARD_CONFIG } from "@/lib/rewards/list-config";
import { listRewardsForStaffPage } from "@/lib/rewards/queries";
import { ActiveToggle } from "./_components/active-toggle";

export const metadata: Metadata = { title: "จัดการของรางวัล | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function StaffRewardsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="จัดการของรางวัล"
          actions={
            <>
              <ButtonLink href="/staff" variant="quiet">
                กลับ
              </ButtonLink>
              <ButtonLink href="/staff/rewards/new" variant="primary">
                เพิ่มของรางวัล
              </ButtonLink>
            </>
          }
        />
      </div>
      <Suspense fallback={<ListSkeleton view="list" toolbar={{ views: false, filters: 1 }} />}>
        <RewardList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const number = new Intl.NumberFormat("th-TH");

async function RewardList({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("/staff/rewards");
  const { params, result } = await loadClamped(STAFF_REWARD_CONFIG, parseListParams(STAFF_REWARD_CONFIG, await searchParams), listRewardsForStaffPage);

  return (
    <>
      <Suspense fallback={<ListToolbarSkeleton views={false} filters={1} />}>
        <ListToolbar base="/staff/rewards" config={STAFF_REWARD_CONFIG} placeholder="ค้นหารางวัล" />
      </Suspense>
      {result.items.length === 0 ? (
        isNarrowed(STAFF_REWARD_CONFIG, params) ? (
          <EmptyState>
            <p>ไม่พบรายการที่ตรงกับคำค้น</p>
            <Link href="/staff/rewards" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
              ล้างการค้นหา
            </Link>
          </EmptyState>
        ) : (
          <EmptyState>ยังไม่มีของรางวัล กด &quot;เพิ่มของรางวัล&quot; เพื่อเริ่ม</EmptyState>
        )
      ) : (
        <>
          <ul className="space-y-3">
            {result.items.map((r) => (
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
          <Pagination base="/staff/rewards" config={STAFF_REWARD_CONFIG} state={params} total={result.total} />
        </>
      )}
    </>
  );
}
