import Link from "next/link";
import { RewardImage } from "@/app/_components/reward-image";
import { Card, Mono } from "@/components/ui";
import type { PublicReward } from "@/lib/home/public-feed";
import { formatCount } from "@/lib/leaderboard/format";
import { LockLine } from "./lock-line";
import { HOME_CONTAINER, HOME_SECTION, SectionHeading } from "./section-heading";

// Rewards without a photo get one of four paper-tone gradients in turn (DESIGN-2 3.2), dimmed in the dark theme.
const PLACEHOLDER_TONES = [
  "bg-[linear-gradient(140deg,oklch(95%_0.03_130),oklch(85%_0.07_140))]",
  "bg-[linear-gradient(140deg,oklch(95%_0.04_90),oklch(84%_0.13_85))]",
  "bg-[linear-gradient(140deg,oklch(94%_0.025_185),oklch(81%_0.06_185))]",
  "bg-[linear-gradient(140deg,oklch(93%_0.02_75),oklch(82%_0.05_75))]",
];

/** 06: rewards with tilted price tags. Hidden entirely when there is nothing to show or the load failed. */
export function RewardsSection({ rewards }: { rewards: PublicReward[] | null }) {
  if (!rewards || rewards.length === 0) return null;
  return (
    <section aria-labelledby="home-rewards" className={HOME_SECTION}>
      <div className={HOME_CONTAINER}>
        <SectionHeading id="rewards" num="06" kicker="ของรางวัล" title="แต้มของคุณ แลกอะไรได้บ้าง" />
        <ul className="mt-7 grid gap-4 min-[400px]:grid-cols-2 lg:grid-cols-4 lg:gap-5.5">
          {rewards.map((r, i) => (
            <Card
              as="li"
              flush
              key={r.id}
              className="min-w-0 overflow-hidden transition-transform duration-[400ms] ease-[var(--ease-out)] hover:-translate-y-1 motion-reduce:transition-none"
            >
              <Link
                href="/rewards"
                className="flex h-full flex-col rounded-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <div className="relative">
                  <RewardImage
                    url={r.imageUrl}
                    className={`aspect-square w-full ${r.imageUrl ? "" : `${PLACEHOLDER_TONES[i % PLACEHOLDER_TONES.length]} dark:brightness-80 dark:saturate-80`}`}
                  />
                  <span className="absolute right-2.5 bottom-2.5 rotate-[4deg] rounded-input border border-dashed border-accent bg-surface px-2.5 py-1 text-sm font-semibold text-accent shadow-card">
                    <Mono text={`${formatCount(r.pointsCost)} แต้ม`} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
                  <h3 className="line-clamp-2 font-display text-[1.0625rem] leading-[1.4] font-semibold break-words text-ink">{r.name}</h3>
                  <p className="mt-1 mb-3.5 text-sm text-muted">
                    <Mono text={`เหลือ ${formatCount(r.stock)} ชิ้น`} />
                  </p>
                  <LockLine>เข้าสู่ระบบเพื่อแลก</LockLine>
                </div>
              </Link>
            </Card>
          ))}
        </ul>
      </div>
    </section>
  );
}
