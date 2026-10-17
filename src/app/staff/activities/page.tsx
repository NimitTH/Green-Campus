import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityDates, Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { statusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { listActivitiesForStaff } from "@/lib/activities/queries";
import { DeleteActivityButton } from "./_components/delete-activity-button";

export const metadata: Metadata = { title: "จัดการกิจกรรม | Green Campus" };

export default function StaffActivitiesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">จัดการกิจกรรม</h1>
        <Link
          href="/staff/activities/new"
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          สร้างกิจกรรม
        </Link>
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
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีกิจกรรม กด &quot;สร้างกิจกรรม&quot; เพื่อเริ่ม
      </section>
    );
  }

  return (
    <ul className="space-y-3">
      {activities.map((a) => (
        <li key={a.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
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
              <Link
                href={`/staff/activities/${a.id}/edit`}
                aria-label={`แก้ไข ${a.title}`}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                แก้ไข
              </Link>
              <DeleteActivityButton activityId={a.id} title={a.title} />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            <ActivityDates startsAt={a.starts_at} endsAt={a.ends_at} />
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">ผู้เข้าร่วม {a.participantCount} คน</p>
        </li>
      ))}
    </ul>
  );
}
