import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { isNarrowed, pageSizeOf, parseListParams } from "@/app/_components/list/list-params";
import { Pagination } from "@/app/_components/list/pagination";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { MY_SUBMISSION_CONFIG } from "@/lib/submissions/list-config";
import { listMySubmissionsPage } from "@/lib/submissions/queries";
import { SubmissionCard, SubmissionRow } from "./_components/submission-card";

export const metadata: Metadata = { title: "ผลที่ส่ง | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function MySubmissionsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="ผลที่ส่ง" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <SubmissionList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SubmissionList({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/my-submissions");
  let params = parseListParams(MY_SUBMISSION_CONFIG, await searchParams);
  let result = await listMySubmissionsPage(user.id, params);
  if (result.total > 0) {
    // past the end (e.g. ?page=999 or the list shrank): show the last page instead
    const lastPage = Math.ceil(result.total / pageSizeOf(MY_SUBMISSION_CONFIG));
    if (params.page > lastPage) {
      params = { ...params, page: lastPage };
      result = await listMySubmissionsPage(user.id, params);
    }
  }

  if (result.total === 0 && !isNarrowed(MY_SUBMISSION_CONFIG, params)) {
    return <EmptyState>ยังไม่มีผลที่ส่ง</EmptyState>;
  }

  return (
    <>
      <Suspense fallback={<ListToolbarSkeleton />}>
        <ListToolbar base="/my-submissions" config={MY_SUBMISSION_CONFIG} placeholder="ค้นหากิจกรรมที่เคยส่ง" />
      </Suspense>
      {result.total === 0 || result.items.length === 0 ? (
        <EmptyState>
          <p>ไม่พบรายการที่ตรงกับคำค้น</p>
          <Link href="/my-submissions" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
            ล้างการค้นหา
          </Link>
        </EmptyState>
      ) : (
        <>
          {params.view === "list" ? (
            <ul className="divide-y divide-rule rounded-card border border-rule bg-surface shadow-sheet">
              {result.items.map((s) => (
                <SubmissionRow key={s.id} submission={s} />
              ))}
            </ul>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((s) => (
                <SubmissionCard key={s.id} submission={s} />
              ))}
            </ul>
          )}
          <Pagination base="/my-submissions" config={MY_SUBMISSION_CONFIG} state={params} total={result.total} />
        </>
      )}
    </>
  );
}
