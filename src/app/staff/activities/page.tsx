import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityDates, Badge } from "@/app/_components/activity-ui";
import { CoverFallback, coverKindForActivity } from "@/app/_components/cover-fallback";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { statusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { STAFF_ACTIVITY_CONFIG } from "@/lib/activities/list-config";
import { listActivitiesForStaffPage } from "@/lib/activities/queries";
import { DeleteActivityButton } from "./_components/delete-activity-button";

export const metadata: Metadata = { title: "จัดการกิจกรรม | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function StaffActivitiesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="จัดการกิจกรรม"
          actions={
            <>
              <ButtonLink href="/staff" variant="quiet">
                กลับ
              </ButtonLink>
              <ButtonLink href="/staff/activities/new" variant="primary">
                สร้างกิจกรรม
              </ButtonLink>
            </>
          }
        />
      </div>
      <Suspense fallback={<ListSkeleton view="list" toolbar={{ views: false, filters: 3 }} />}>
        <ActivityList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const STATUS_TONE = { draft: "gray", open: "green", closed: "amber" } as const;

/** 96x64 cover thumbnail, or the CoverFallback when the activity has none. */
function Thumb({ url, type }: { url: string | null; type: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL
    return <img src={url} alt="" loading="lazy" width={96} height={64} className="h-16 w-24 shrink-0 rounded-input object-cover" />;
  }
  return <CoverFallback kind={coverKindForActivity(type)} className="h-16 w-24 shrink-0 rounded-input" />;
}

async function ActivityList({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("/staff/activities");
  const { params, result } = await loadClamped(
    STAFF_ACTIVITY_CONFIG,
    parseListParams(STAFF_ACTIVITY_CONFIG, await searchParams),
    listActivitiesForStaffPage,
  );

  return (
    <>
      <Suspense fallback={<ListToolbarSkeleton views={false} filters={3} />}>
        <ListToolbar base="/staff/activities" config={STAFF_ACTIVITY_CONFIG} placeholder="ค้นหากิจกรรม" />
      </Suspense>
      {result.total === 0 || result.items.length === 0 ? (
        isNarrowed(STAFF_ACTIVITY_CONFIG, params) ? (
          <EmptyState>
            <p>ไม่พบรายการที่ตรงกับคำค้น</p>
            <Link href="/staff/activities" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
              ล้างการค้นหา
            </Link>
          </EmptyState>
        ) : (
          <EmptyState>
            ยังไม่มีกิจกรรม กด &quot;สร้างกิจกรรม&quot; เพื่อเริ่ม
          </EmptyState>
        )
      ) : (
        <>
          <ul className="space-y-3">
            {result.items.map((a) => (
              <Card as="li" key={a.id} className="flex gap-3">
                <Thumb url={a.coverUrl} type={a.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold break-words">{a.title}</h2>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge tone={STATUS_TONE[a.status]}>{statusLabelTh(a.status)}</Badge>
                        <Badge>{typeLabelTh(a.type)}</Badge>
                        {a.requires_code ? <Badge>ใช้รหัสจุดชั่ง</Badge> : null}
                        {a.is_offsite ? <Badge>นอกโรงเรียน</Badge> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      {a.status !== "draft" ? (
                        <ButtonLink href={`/activities/${a.id}`} aria-label={`ดู ${a.title}`} variant="card">
                          ดู
                        </ButtonLink>
                      ) : null}
                      <ButtonLink href={`/staff/activities/${a.id}/edit`} aria-label={`แก้ไข ${a.title}`} variant="card">
                        แก้ไข
                      </ButtonLink>
                      <DeleteActivityButton activityId={a.id} title={a.title} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    <ActivityDates startsAt={a.starts_at} endsAt={a.ends_at} />
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    ผู้เข้าร่วม <span className="font-mono">{a.participantCount}</span> คน
                  </p>
                </div>
              </Card>
            ))}
          </ul>
          <Pagination base="/staff/activities" config={STAFF_ACTIVITY_CONFIG} state={params} total={result.total} />
        </>
      )}
    </>
  );
}
