import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityDates, Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { statusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { listActivitiesForStaff } from "@/lib/activities/queries";
import { DeleteActivityButton } from "./_components/delete-activity-button";

export const metadata: Metadata = { title: "จัดการกิจกรรม | Green Campus" };

export default function StaffActivitiesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="จัดการกิจกรรม"
          actions={
            <ButtonLink href="/staff/activities/new" variant="primary">
              สร้างกิจกรรม
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <ActivityList />
      </Suspense>
    </main>
  );
}

const STATUS_TONE = { draft: "gray", open: "green", closed: "amber" } as const;

async function ActivityList() {
  await requireStaff("/staff/activities");
  const activities = await listActivitiesForStaff();

  if (activities.length === 0) {
    return (
      <EmptyState>
        ยังไม่มีกิจกรรม กด &quot;สร้างกิจกรรม&quot; เพื่อเริ่ม
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {activities.map((a) => (
        <Card as="li" key={a.id}>
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
        </Card>
      ))}
    </ul>
  );
}
