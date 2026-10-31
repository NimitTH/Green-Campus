import Link from "next/link";
import { activityProgress } from "@/app/_components/home/activity-progress";
import { LeafMark } from "@/app/_components/leaf-mark";
import { Badge, Card } from "@/components/ui";
import { statusLabelTh, typeLabelTh } from "@/lib/activities/labels";
import type { StudentActivityItem } from "@/lib/activities/queries";
import { isEnded } from "@/lib/activities/status";

// One activity on /activities (DESIGN-3 6.2, mockup C/C2): cover, type, title, two lines of description,
// "โดย ชื่อ · เหลือ N วัน" and the time progress bar. The whole card (or list row) links to the detail page.

const LINK_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Cover image, or kraft paper with the leaf when the activity has none. */
function Cover({ url, className }: { url: string | null; className: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, already resized in the browser
    return <img src={url} alt="" loading="lazy" className={`${className} object-cover`} />;
  }
  return (
    <div aria-hidden="true" className={`${className} paper-kraft grid place-items-center [&>svg]:size-8`}>
      <LeafMark />
    </div>
  );
}

function Badges({ activity: a }: { activity: StudentActivityItem }) {
  return (
    <span className="flex flex-wrap gap-2">
      <Badge>{typeLabelTh(a.type)}</Badge>
      {a.joined ? <Badge tone="green">เข้าร่วมแล้ว</Badge> : null}
      {a.status !== "open" ? <Badge tone="amber">{statusLabelTh(a.status)}</Badge> : null}
      {a.status === "open" && isEnded(a.ends_at) ? <Badge tone="amber">สิ้นสุดแล้ว</Badge> : null}
    </span>
  );
}

function Meta({ activity: a, now }: { activity: StudentActivityItem; now: Date }) {
  const { percent, daysLeft } = activityProgress(a.starts_at, a.ends_at, now);
  const progressId = `activity-${a.id}-progress`;
  return (
    <>
      <p className="mt-1 text-sm text-muted">
        โดย {a.creatorName ?? "-"} · เหลือ <b className="font-mono font-semibold text-ink">{daysLeft}</b> วัน
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-labelledby={progressId}
        className="mt-2 h-2 overflow-hidden rounded-full border border-rule bg-paper-2"
      >
        <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <span id={progressId} className="sr-only">
        ผ่านไป {percent}%
      </span>
    </>
  );
}

export function ActivityCard({ activity: a, now }: { activity: StudentActivityItem; now: Date }) {
  return (
    <Card as="li" flush deco="pin" tilt className="min-w-0 hover:border-accent">
      <Link href={`/activities/${a.id}`} className={`block h-full rounded-card p-2.5 pb-4 ${LINK_FOCUS}`}>
        <Cover url={a.coverUrl} className="aspect-[4/3] w-full rounded-input" />
        <div className="mx-1 mt-3">
          <Badges activity={a} />
          <h2 className="mt-2 line-clamp-3 font-display text-lg leading-snug font-semibold break-words text-ink">{a.title}</h2>
          {a.description ? <p className="mt-1 line-clamp-2 text-sm break-words text-ink">{a.description}</p> : null}
          <Meta activity={a} now={now} />
        </div>
      </Link>
    </Card>
  );
}

export function ActivityRow({ activity: a, now }: { activity: StudentActivityItem; now: Date }) {
  return (
    <li className="min-w-0">
      <Link href={`/activities/${a.id}`} className={`flex gap-3 rounded-card p-3 hover:bg-accent-soft md:p-4 ${LINK_FOCUS}`}>
        <Cover url={a.coverUrl} className="h-16 w-24 shrink-0 rounded-input" />
        <div className="min-w-0 flex-1">
          <Badges activity={a} />
          <h2 className="mt-1 font-display text-base leading-snug font-semibold break-words text-ink">{a.title}</h2>
          {a.description ? <p className="mt-0.5 line-clamp-2 text-sm break-words text-ink">{a.description}</p> : null}
          <Meta activity={a} now={now} />
        </div>
      </Link>
    </li>
  );
}
