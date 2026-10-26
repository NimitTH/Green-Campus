import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { PageHeader } from "@/components/ui";
import { submissionStatusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { requireStaff } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { ABNORMAL_FACTOR, isAbnormalTotal, submissionTotal } from "@/lib/reviews/abnormal";
import { estimateSubmission } from "@/lib/reviews/estimate";
import { formatGramsTh, formatKgTh, studentHistoryTh } from "@/lib/reviews/format";
import {
  evidenceSignedUrl,
  getSubmissionForReview,
  otherSubmissionTotals,
  studentActivityHistory,
  type SubmissionForReview,
} from "@/lib/reviews/queries";
import { isUuid } from "@/lib/uuid";
import { ReviewActions } from "../_components/review-actions";

export const metadata: Metadata = { title: "ตรวจผล | Green Campus" };

const TONE: Record<string, "gray" | "green" | "amber"> = { pending: "amber", approved: "green", rejected: "gray" };
const carbonFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });

/** Digit runs in font-mono, Thai words and units stay in the sans font (Geist Mono has no Thai glyphs). */
function Mono({ text }: { text: string }) {
  return (
    <>
      {text.split(/([d][d,.]*)/).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-mono">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

// cacheComponents: params and the session are request-time data, read them inside <Suspense>.
export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <Link href="/staff/reviews" className="mb-4 inline-block text-sm text-accent underline">
        ← ผลที่รอตรวจ
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <Review params={params} />
      </Suspense>
    </main>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff(`/staff/reviews/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();
  const submission = await getSubmissionForReview(id);
  if (!submission) notFound();

  const total = submissionTotal(submission.activity.type, submission.items.map((i) => i.quantity));
  const [photoUrl, others, history] = await Promise.all([
    evidenceSignedUrl(submission.evidencePath),
    total === null ? Promise.resolve([]) : otherSubmissionTotals(submission.activity.id, submission.id),
    studentActivityHistory(submission.activity.id, submission.studentId, submission.id),
  ]);
  const abnormal = isAbnormalTotal(total, others);
  const historyLine = studentHistoryTh(history.pending, history.approved);
  const pending = submission.status === "pending";

  return (
    <>
      <div className="mb-5">
        <PageHeader
          title={<span className="break-words">{submission.activity.title}</span>}
          actions={<Badge tone={TONE[submission.status] ?? "gray"}>{submissionStatusLabelTh(submission.status)}</Badge>}
        />
        <dl className="mt-2 grid gap-1 text-sm text-ink sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="text-muted">นักเรียน</dt>
          <dd className="break-words">{submission.studentName}</dd>
          <dt className="text-muted">ชนิดกิจกรรม</dt>
          <dd>{typeLabelTh(submission.activity.type)}</dd>
          <dt className="text-muted">ส่งเมื่อ</dt>
          <dd>{formatBangkok(submission.createdAt)}</dd>
        </dl>
      </div>

      {historyLine ? (
        <p data-testid="student-history" className="mb-4 text-sm text-ink">
          {historyLine}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="photo-heading">
          <h2 id="photo-heading" className="mb-2 font-display text-lg font-semibold">
            รูปหลักฐาน
          </h2>
          {photoUrl ? (
            // A short-lived signed URL (300 s): the image optimizer would cache it past expiry.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`รูปหลักฐานของ ${submission.studentName}`}
              className="w-full rounded-card border border-rule object-contain"
            />
          ) : (
            <p className="rounded-card border border-dashed border-rule-strong p-6 text-center text-muted">
              ไม่พบรูปหลักฐาน
            </p>
          )}
        </section>

        <section aria-labelledby="numbers-heading">
          <h2 id="numbers-heading" className="mb-2 font-display text-lg font-semibold">
            ข้อมูลที่นักเรียนกรอก
          </h2>
          <Amounts submission={submission} />
          {abnormal ? (
            <p
              role="note"
              data-testid="abnormal-flag"
              className="mt-3 rounded-input border border-warn p-3 text-sm font-medium text-warn"
            >
              ⚠ ปริมาณสูงผิดปกติ: มากกว่า {ABNORMAL_FACTOR} เท่าของค่าเฉลี่ยผลอื่นในกิจกรรมนี้ ตรวจรูปให้ละเอียดก่อนอนุมัติ
            </p>
          ) : null}

          {pending ? (
            <Estimate submission={submission} />
          ) : (
            <Outcome submission={submission} />
          )}

          {pending ? (
            <div className="mt-6">
              {submission.studentId === user.id ? (
                <p className="text-sm text-muted">ผลนี้เป็นของคุณ ให้ครูหรือผู้ดูแลคนอื่นตรวจ</p>
              ) : (
                <ReviewActions submissionId={submission.id} />
              )}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function Amounts({ submission }: { submission: SubmissionForReview }) {
  const { type } = submission.activity;
  if (type === "fixed") {
    return <p className="text-sm">เข้าร่วมกิจกรรม (แต้มคงที่ต่อครั้ง)</p>;
  }
  if (type === "trees") {
    const count = submission.items.reduce((sum, i) => sum + i.quantity, 0);
    return (
      <p className="text-lg font-semibold" data-testid="tree-count">
        <Mono text={`${count.toLocaleString("th-TH")} ต้น`} />
      </p>
    );
  }
  const total = submission.items.reduce((sum, i) => sum + i.quantity, 0);
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-rule text-left text-muted">
          <th className="py-1 font-normal">กลุ่มขยะ</th>
          <th className="py-1 text-right font-normal">น้ำหนัก</th>
        </tr>
      </thead>
      <tbody>
        {submission.items.map((item, index) => (
          <tr key={index} className="border-b border-rule">
            <td className="py-2">{item.category?.name ?? "-"}</td>
            <td className="py-2 text-right">
              <Mono text={formatGramsTh(item.quantity)} />
              <span className="block text-xs text-muted">
                <Mono text={formatKgTh(item.quantity)} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="py-2 font-semibold">รวม</td>
          <td className="py-2 text-right font-semibold">
            <Mono text={formatKgTh(total)} />
          </td>
        </tr>
      </tfoot>
    </table>
    </div>
  );
}

function Estimate({ submission }: { submission: SubmissionForReview }) {
  const estimate = estimateSubmission(submission.activity, submission.items);
  return (
    <div className="mt-4 rounded-card bg-paper-2 p-4 text-sm">
      <p className="font-medium">
        ประมาณการ: <Mono text={estimate.points.toLocaleString("th-TH")} /> แต้ม · carbon{" "}
        <Mono text={carbonFormat.format(estimate.carbonKg)} /> กก. CO2e
      </p>
      <p className="mt-1 text-xs text-muted">
        คิดจากอัตราปัจจุบัน แต้มจริงคำนวณจากอัตรา ณ ตอนกดอนุมัติ
      </p>
    </div>
  );
}

function Outcome({ submission }: { submission: SubmissionForReview }) {
  return (
    <div className="mt-4 space-y-1 rounded-card bg-paper-2 p-4 text-sm">
      <p>
        {submission.status === "approved" ? "อนุมัติโดย" : "ตรวจโดย"} {submission.reviewerName ?? "-"}
        {submission.reviewedAt ? ` เมื่อ ${formatBangkok(submission.reviewedAt)}` : ""}
      </p>
      {submission.status === "approved" && submission.earned ? (
        <p className="font-medium">
          ได้ <Mono text={submission.earned.points.toLocaleString("th-TH")} /> แต้ม · carbon{" "}
          <Mono text={carbonFormat.format(submission.earned.carbonKg)} /> กก. CO2e
        </p>
      ) : null}
      {submission.status === "rejected" && submission.rejectReason ? (
        <p className="text-danger">เหตุผล: {submission.rejectReason}</p>
      ) : null}
    </div>
  );
}
