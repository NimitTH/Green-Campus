import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { ACTIVITY_LIST_CONFIG } from "@/lib/activities/list-config";
import { listActivitiesForStudentPage } from "@/lib/activities/queries";
import { ActivityCard, ActivityRow } from "./_components/activity-card";

export const metadata: Metadata = { title: "กิจกรรม | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// One list of the open activities plus the ones the student joined (DESIGN-3 6.2, DESIGN-4 3): search, sort +
// direction, the joined / type filters, card/list view, 12 per page. The heading is in the static shell; the toolbar (useSearchParams) and the results (the session and
// searchParams) each stream in their own <Suspense>, as on /articles.
export default function ActivitiesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6">
      <div className="mb-5">
        <PageHeader title="กิจกรรม" />
      </div>
      <Suspense fallback={<ListToolbarSkeleton filters={2} />}>
        <ListToolbar base="/activities" config={ACTIVITY_LIST_CONFIG} placeholder="ค้นหากิจกรรม" />
      </Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <ActivityResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ActivityResults({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/activities");
  // past the end (e.g. ?page=999 or the list shrank): the last page instead
  const { params, result } = await loadClamped(ACTIVITY_LIST_CONFIG, parseListParams(ACTIVITY_LIST_CONFIG, await searchParams), (p) =>
    listActivitiesForStudentPage(user.id, p),
  );
  if (result.total === 0 || result.items.length === 0) {
    if (isNarrowed(ACTIVITY_LIST_CONFIG, params)) {
      return (
        <EmptyState>
          <p>ไม่พบรายการที่ตรงกับคำค้น</p>
          <Link href="/activities" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
            ล้างการค้นหา
          </Link>
        </EmptyState>
      );
    }
    return <EmptyState>ยังไม่มีกิจกรรมที่เปิดรับ ลองกลับมาดูใหม่ภายหลัง</EmptyState>;
  }
  const now = new Date();
  return (
    <>
      {params.view === "list" ? (
        <ul className="divide-y divide-rule rounded-card border border-rule bg-surface shadow-sheet">
          {result.items.map((a) => (
            <ActivityRow key={a.id} activity={a} now={now} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-6 pt-2 sm:grid-cols-2 md:grid-cols-3">
          {result.items.map((a) => (
            <ActivityCard key={a.id} activity={a} now={now} />
          ))}
        </ul>
      )}
      <Pagination base="/activities" config={ACTIVITY_LIST_CONFIG} state={params} total={result.total} />
    </>
  );
}
