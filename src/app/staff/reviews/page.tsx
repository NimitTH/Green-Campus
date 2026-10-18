import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">ผลที่รอตรวจ</h1>
        <Link href="/staff" className="text-sm text-green-700 underline">
          กลับ
        </Link>
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
          className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
        >
          {doneMessage}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
          ไม่มีผลที่รอตรวจ
        </section>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} data-testid="review-row">
              <Link
                href={`/staff/reviews/${row.id}`}
                className="block rounded-2xl border border-gray-200 p-4 hover:border-green-600 dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium break-words">{row.activityTitle}</p>
                  <Badge>{typeLabelTh(row.activityType)}</Badge>
                </div>
                <p className="mt-1 text-sm break-words">{row.studentName}</p>
                <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>ส่งเมื่อ {formatBangkok(row.createdAt)}</span>
                  <span>{summaryTh(row.activityType, row.quantities)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
