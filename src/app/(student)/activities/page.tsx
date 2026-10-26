import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityDates, Badge } from "@/app/_components/activity-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { statusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { listActivitiesForStudent, type ActivityRow } from "@/lib/activities/queries";
import { isEnded } from "@/lib/activities/status";

export const metadata: Metadata = { title: "กิจกรรม | Green Campus" };

export default function ActivitiesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="กิจกรรม" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <ActivityLists />
      </Suspense>
    </main>
  );
}

async function ActivityLists() {
  const user = await requireUser("/activities");
  const { open, joined } = await listActivitiesForStudent(user.id);

  if (open.length === 0 && joined.length === 0) {
    return (
      <EmptyState>ยังไม่มีกิจกรรมที่เปิดรับ ลองกลับมาดูใหม่ภายหลัง</EmptyState>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="open-heading">
        <h2 id="open-heading" className="mb-3 font-display text-xl font-semibold">
          เปิดรับสมัคร
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">ตอนนี้ไม่มีกิจกรรมใหม่ที่เปิดรับ</p>
        ) : (
          <ActivityItems items={open} />
        )}
      </section>
      <section aria-labelledby="joined-heading">
        <h2 id="joined-heading" className="mb-3 font-display text-xl font-semibold">
          กิจกรรมที่เข้าร่วมแล้ว
        </h2>
        {joined.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่ได้เข้าร่วมกิจกรรมใด</p>
        ) : (
          <ActivityItems items={joined} />
        )}
      </section>
    </div>
  );
}

function ActivityItems({ items }: { items: ActivityRow[] }) {
  return (
    <ul className="space-y-3">
      {items.map((a) => {
        const ended = isEnded(a.ends_at);
        return (
          <Card as="li" key={a.id} flush className="transition-colors hover:border-accent">
            <Link href={`/activities/${a.id}`} className="block rounded-card p-4 md:p-5">
              <span className="block font-semibold break-words">{a.title}</span>
              <span className="mt-1 flex flex-wrap gap-2">
                <Badge>{typeLabelTh(a.type)}</Badge>
                {a.status !== "open" ? <Badge tone="amber">{statusLabelTh(a.status)}</Badge> : null}
                {a.status === "open" && ended ? <Badge tone="amber">สิ้นสุดแล้ว</Badge> : null}
                <Badge>{a.is_offsite ? "นอกโรงเรียน" : "ในโรงเรียน"}</Badge>
              </span>
              <span className="mt-2 block text-sm text-muted">
                <ActivityDates startsAt={a.starts_at} endsAt={a.ends_at} />
              </span>
              {a.location ? (
                <span className="mt-1 block text-sm text-muted">{a.location}</span>
              ) : null}
            </Link>
          </Card>
        );
      })}
    </ul>
  );
}
