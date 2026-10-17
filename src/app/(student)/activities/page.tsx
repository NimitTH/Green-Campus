import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityDates, Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { statusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { listActivitiesForStudent, type ActivityRow } from "@/lib/activities/queries";
import { isEnded } from "@/lib/activities/status";

export const metadata: Metadata = { title: "กิจกรรม | Green Campus" };

export default function ActivitiesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">กิจกรรม</h1>
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
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีกิจกรรมที่เปิดรับ ลองกลับมาดูใหม่ภายหลัง
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="open-heading">
        <h2 id="open-heading" className="mb-3 font-semibold">
          เปิดรับสมัคร
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">ตอนนี้ไม่มีกิจกรรมใหม่ที่เปิดรับ</p>
        ) : (
          <ActivityItems items={open} />
        )}
      </section>
      <section aria-labelledby="joined-heading">
        <h2 id="joined-heading" className="mb-3 font-semibold">
          กิจกรรมที่เข้าร่วมแล้ว
        </h2>
        {joined.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">ยังไม่ได้เข้าร่วมกิจกรรมใด</p>
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
          <li key={a.id}>
            <Link
              href={`/activities/${a.id}`}
              className="block rounded-xl border border-gray-200 p-4 hover:border-green-600 dark:border-gray-800"
            >
              <span className="block font-semibold break-words">{a.title}</span>
              <span className="mt-1 flex flex-wrap gap-2">
                <Badge>{typeLabelTh(a.type)}</Badge>
                {a.status !== "open" ? <Badge tone="amber">{statusLabelTh(a.status)}</Badge> : null}
                {a.status === "open" && ended ? <Badge tone="amber">สิ้นสุดแล้ว</Badge> : null}
                <Badge>{a.is_offsite ? "นอกโรงเรียน" : "ในโรงเรียน"}</Badge>
              </span>
              <span className="mt-2 block text-sm text-gray-600 dark:text-gray-400">
                <ActivityDates startsAt={a.starts_at} endsAt={a.ends_at} />
              </span>
              {a.location ? (
                <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">{a.location}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
