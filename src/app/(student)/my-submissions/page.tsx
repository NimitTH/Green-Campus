import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
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
      <Suspense fallback={<ListSkeleton toolbar={false} />}>
        <SubmissionList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SubmissionList({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/my-submissions");
  // past the end (e.g. ?page=999 or the list shrank): the last page instead
  const { params, result } = await loadClamped(MY_SUBMISSION_CONFIG, parseListParams(MY_SUBMISSION_CONFIG, await searchParams), (p) =>
    listMySubmissionsPage(user.id, p),
  );

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
