import Link from "next/link";
import { Card, Mono } from "@/components/ui";
import { typeLabelTh } from "@/lib/activities/labels";
import { formatBangkok } from "@/lib/datetime";
import type { PublicActivity } from "@/lib/home/public-feed";
import { activityProgress } from "./activity-progress";
import { LockLine } from "./lock-line";
import { HOME_CONTAINER, HOME_SECTION, SectionHeading } from "./section-heading";

/** 05: open activities pinned on a kraft board. Presentational; page.tsx fetches and passes `now`. */
export function ActivitiesSection({ activities, now }: { activities: PublicActivity[] | null; now: Date }) {
  return (
    <section aria-labelledby="home-activities" className={`paper-kraft paper-torn [--torn-bg:var(--kraft-2)] ${HOME_SECTION}`}>
      <div className={HOME_CONTAINER}>
        <SectionHeading id="activities" num="05" kicker="กิจกรรม" title="กิจกรรมที่เปิดรับอยู่" />
        {activities === null ? (
          <p className="mt-7 text-ink">ยังโหลดกิจกรรมไม่ได้ในขณะนี้</p>
        ) : activities.length === 0 ? (
          <p className="mt-7 text-ink">ยังไม่มีกิจกรรมที่เปิดรับ</p>
        ) : (
          <ul className="mt-7 grid gap-5.5 sm:grid-cols-2 lg:grid-cols-3">
            {activities.slice(0, 3).map((a) => (
              <ActivityCard key={a.id} activity={a} now={now} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ActivityCard({ activity: a, now }: { activity: PublicActivity; now: Date }) {
  const { percent, daysLeft } = activityProgress(a.startsAt, a.endsAt, now);
  const progressId = `home-activity-${a.id}-progress`;
  return (
    <Card
      as="li"
      flush
      className="min-w-0 transition-transform duration-[400ms] ease-[var(--ease-out)] hover:-translate-y-1 motion-reduce:transition-none"
    >
      <Link
        href={`/activities/${a.id}`}
        className="flex h-full flex-col rounded-card p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="self-start rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-ink">{typeLabelTh(a.type)}</span>
        <h3 className="mt-2.5 line-clamp-3 font-display text-lg leading-[1.4] font-semibold break-words text-ink">{a.title}</h3>
        <p className="mt-1.5 text-sm text-muted">
          <Mono text={`${formatBangkok(a.startsAt)} – ${formatBangkok(a.endsAt)}`} />
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-labelledby={progressId}
          className="mt-3.5 h-2.5 overflow-hidden rounded-full border border-rule bg-paper-2"
        >
          <span
            className="block h-full rounded-full bg-[repeating-linear-gradient(-45deg,oklch(100%_0_0/0.18)_0_6px,transparent_6px_12px),linear-gradient(90deg,color-mix(in_oklab,var(--accent)_55%,var(--sun)),var(--accent)_60%,var(--accent-deep))]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1.5 mb-3.5 flex justify-between gap-3 text-sm text-muted">
          <span id={progressId} aria-hidden="true">
            ผ่านไป <b className="font-mono font-semibold text-ink">{percent}%</b>
          </span>
          <span>
            เหลือ <b className="font-mono font-semibold text-ink">{daysLeft}</b> วัน
          </span>
        </div>
        <LockLine>เข้าสู่ระบบเพื่อเข้าร่วม</LockLine>
      </Link>
    </Card>
  );
}
