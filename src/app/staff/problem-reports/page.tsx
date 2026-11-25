import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, Card, EmptyState, Mono, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { REPORTS_PER_PAGE, reportLinkHref } from "@/lib/problem-reports/format";
import { listProblemReports } from "@/lib/problem-reports/queries";
import { ResolveForm } from "./_components/resolve-form";

export const metadata: Metadata = { title: "แจ้งปัญหาการใช้งาน | Green Campus" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function toPage(v: string | string[] | undefined): number {
  const n = typeof v === "string" && /^\d{1,6}$/.test(v) ? Number(v) : 1;
  return n >= 1 ? n : 1;
}

const pageHref = (page: number) => (page > 1 ? `/staff/problem-reports?page=${page}` : "/staff/problem-reports");

// Round 6 (old-site features 5): admins read website problem reports (open first) and mark them done.
export default function ProblemReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="แจ้งปัญหาการใช้งาน"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<ListSkeleton view="list" toolbar={false} />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reports({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin("/staff/problem-reports");
  const page = toPage((await searchParams).page);
  const { items, total } = await listProblemReports(page);
  const pages = Math.max(1, Math.ceil(total / REPORTS_PER_PAGE));
  if (page > pages) redirect(pageHref(pages));
  if (items.length === 0) return <EmptyState>ยังไม่มีการแจ้งปัญหา</EmptyState>;

  return (
    <>
      <ul className="space-y-3">
        {items.map((r) => (
          <Card as="li" key={r.id} data-testid="problem-report" data-status={r.status}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.status === "open" ? "amber" : "green"}>{r.status === "open" ? "รอดำเนินการ" : "แก้แล้ว"}</Badge>
              <span className="text-sm font-semibold break-words text-ink">{r.reporterName}</span>
              <span className="text-xs text-muted">
                <Mono text={formatBangkok(r.createdAt)} />
              </span>
            </div>
            <p className="mt-2 break-words whitespace-pre-line text-ink">{r.message}</p>
            {r.pageUrl ? (
              <p className="mt-2 text-sm">
                <span className="text-muted">หน้าที่พบปัญหา </span>
                {reportLinkHref(r.pageUrl) ? (
                  <Link href={r.pageUrl} className="inline-flex min-h-11 items-center font-mono break-all text-accent underline underline-offset-4 md:min-h-0">
                    {r.pageUrl}
                  </Link>
                ) : (
                  <span className="font-mono break-all text-ink">{r.pageUrl}</span>
                )}
              </p>
            ) : null}
            {r.status === "open" ? (
              <ResolveForm id={r.id} />
            ) : r.adminNote ? (
              <p className="mt-2 text-sm text-muted">หมายเหตุ: {r.adminNote}</p>
            ) : null}
          </Card>
        ))}
      </ul>
      {pages > 1 ? (
        <nav aria-label="หน้า" className="mt-4 flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <ButtonLink href={pageHref(page - 1)} variant="card">
              ก่อนหน้า
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="text-muted">
            หน้า <span className="font-mono">{page}</span> / <span className="font-mono">{pages}</span>
          </span>
          {page < pages ? (
            <ButtonLink href={pageHref(page + 1)} variant="card">
              ถัดไป
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
