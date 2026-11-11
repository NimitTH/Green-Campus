import Link from "next/link";
import { Badge } from "@/app/_components/activity-ui";
import { CoverFallback, coverKindForActivity } from "@/app/_components/cover-fallback";
import { Card } from "@/components/ui";
import { submissionStatusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import { formatBangkok } from "@/lib/datetime";
import type { MySubmission } from "@/lib/submissions/queries";

// One submission on /my-submissions, as a card (cover on top) or a row (96x64 thumbnail). The cover is the only link
// (to the activity); the text is not a link, so links never nest. Both keep data-testid="submission".

const TONE: Record<string, "gray" | "green" | "amber"> = { pending: "amber", approved: "green", rejected: "gray" };
const carbonFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });

function Cover({ s, className }: { s: MySubmission; className: string }) {
  return (
    <Link
      href={`/activities/${s.activityId}`}
      aria-label={`ดูกิจกรรม ${s.activityTitle}`}
      className={`block shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      {s.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
        <img src={s.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <CoverFallback kind={coverKindForActivity(s.activityType)} className="size-full" />
      )}
    </Link>
  );
}

function Body({ s }: { s: MySubmission }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium break-words">{s.activityTitle}</p>
        <Badge tone={TONE[s.status] ?? "gray"}>{submissionStatusLabelTh(s.status)}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted">
        {typeLabelTh(s.activityType)} · {s.amountText}
      </p>
      <p className="mt-1 text-sm text-muted">ส่งเมื่อ {formatBangkok(s.createdAt)}</p>
      {s.status === "approved" && s.points !== null ? (
        <p className="mt-2 text-sm text-accent">
          ได้ {s.points.toLocaleString("th-TH")} แต้ม
          {s.carbonKg !== null ? ` · ${carbonFormat.format(s.carbonKg)} กก. CO2e` : ""}
        </p>
      ) : null}
      {s.status === "rejected" && s.rejectReason ? <p className="mt-2 text-sm text-danger">เหตุผล: {s.rejectReason}</p> : null}
    </>
  );
}

export function SubmissionCard({ submission: s }: { submission: MySubmission }) {
  return (
    <Card as="li" flush data-testid="submission" className="flex min-w-0 flex-col overflow-hidden">
      <Cover s={s} className="aspect-[4/3] w-full" />
      <div className="p-4">
        <Body s={s} />
      </div>
    </Card>
  );
}

export function SubmissionRow({ submission: s }: { submission: MySubmission }) {
  return (
    <li data-testid="submission" className="flex min-w-0 items-start gap-3 p-3 md:p-4">
      <Cover s={s} className="h-16 w-24 overflow-hidden rounded-input" />
      <div className="min-w-0 flex-1">
        <Body s={s} />
      </div>
    </li>
  );
}
