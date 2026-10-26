import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { typeLabelTh } from "@/lib/activities/labels";
import { requireStaff } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { summaryTh } from "@/lib/reviews/format";
import { listPendingSubmissions } from "@/lib/reviews/queries";

export const metadata: Metadata = { title: "ตรวจผล | Green Campus" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const DONE_MESSAGES: Record<string, string> = {
  approved: "อนุมัติผลเรียบร้อย นักเรียนได้รับแต้มและแจ้งเตือนแล้ว",
  rejected: "บันทึกว่าไม่ผ่านเรียบร้อย นักเรียนได้รับแจ้งเตือนพร้อมเหตุผลแล้ว",
};

// cacheComponents: searchParams and the session are request-time data, read them inside <Suspense>.
export default function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="ผลที่รอตรวจ"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Queue({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("/staff/reviews");
  const { done } = await searchParams;
  const doneMessage =
    typeof done === "string" && Object.prototype.hasOwnProperty.call(DONE_MESSAGES, done) ? DONE_MESSAGES[done] : null;
  const rows = await listPendingSubmissions();

  return (
    <>
      {doneMessage ? (
        <p
          role="status"
          className="mb-4 rounded-input border border-accent bg-accent-soft p-3 text-sm text-ink"
        >
          {doneMessage}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <section className="rounded-card border border-dashed border-rule-strong p-6 text-center text-muted">
          ไม่มีผลที่รอตรวจ
        </section>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <Card as="li" flush key={row.id} data-testid="review-row" className="transition-colors hover:border-accent">
              <Link
                href={`/staff/reviews/${row.id}`}
                className="block rounded-card p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium break-words">{row.activityTitle}</p>
                  <Badge>{typeLabelTh(row.activityType)}</Badge>
                </div>
                <p className="mt-1 text-sm break-words">{row.studentName}</p>
                <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-muted">
                  <span>ส่งเมื่อ {formatBangkok(row.createdAt)}</span>
                  <span>{summaryTh(row.activityType, row.quantities)}</span>
                </p>
              </Link>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
