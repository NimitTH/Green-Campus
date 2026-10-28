import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { ActivitiesSection } from "@/app/_components/home/activities-section";
import { ArticlesSection } from "@/app/_components/home/articles-section";
import { AudienceSection } from "@/app/_components/home/audience-section";
import { ClosingCta } from "@/app/_components/home/closing-cta";
import { FactsSection } from "@/app/_components/home/facts-section";
import { Hero } from "@/app/_components/home/hero";
import { ProblemSection } from "@/app/_components/home/problem-section";
import { ProcessSection } from "@/app/_components/home/process-section";
import { RewardsSection } from "@/app/_components/home/rewards-section";
import { SiteFooter } from "@/app/_components/site-footer";
import { SiteHeader } from "@/app/_components/site-header";
import { listPublishedArticles, type PublicArticleSummary } from "@/lib/articles/public";
import { getActiveRewards, getOpenActivities, type PublicActivity, type PublicReward } from "@/lib/home/public-feed";
import { formatCount, formatKg, formatKgFromGrams, type PublicStats } from "@/lib/leaderboard/format";
import { getPublicStats } from "@/lib/leaderboard/public-stats";

// The public home page (DESIGN-2 5). Static shell; every data block is cached anonymous data streamed in its
// own Suspense boundary, so one failing source never blanks the page.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero
          stats={
            <Suspense fallback={<Skeleton className="h-44 rounded-card bg-paper-2 sm:h-24" />}>
              <PublicTotals />
            </Suspense>
          }
        />
        <ProblemSection />
        <ProcessSection />
        <AudienceSection />
        <FactsSection />
        <Suspense fallback={<Skeleton className="paper-kraft paper-torn h-[56rem] sm:h-[46rem] lg:h-[31rem]" />}>
          <OpenActivities />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[110rem] min-[400px]:h-[58rem] sm:h-[80rem] lg:h-[42rem]" />}>
          <ActiveRewards />
        </Suspense>
        <Suspense fallback={<Skeleton className="paper-dots paper-torn h-[105rem] [--torn-bg:var(--paper)] min-[400px]:h-[48rem] sm:h-[60rem] lg:h-[34rem]" />}>
          <LatestArticles />
        </Suspense>
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/** Paper-coloured placeholder the size of the block it stands in for (no layout jump when it streams in). */
function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`w-full ${className}`} />;
}

// Whole-school totals, no names. A failed load leaves a quiet line and the rest of the page still renders.
async function PublicTotals() {
  let stats: PublicStats | null;
  try {
    stats = await getPublicStats();
  } catch {
    stats = null;
  }
  if (!stats) return <p className="text-sm text-muted">ยังโหลดสถิติรวมไม่ได้ในขณะนี้</p>;
  const cards = [
    { id: "stat-carbon", label: "carbon ที่ลดได้", value: formatKg(stats.carbonKg), unit: "กก. CO2e" },
    { id: "stat-waste", label: "น้ำหนักขยะที่เก็บ", value: formatKgFromGrams(stats.wasteGrams), unit: "กก." },
    { id: "stat-trees", label: "ต้นไม้ที่ปลูก", value: formatCount(stats.trees), unit: "ต้น" },
  ];
  // A ledger row: a heavy rule on top, dashed separators, mono figures. Stacked label-left / figure-right on phones.
  return (
    <dl className="grid border-t-2 border-ink sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.id}
          data-testid={c.id}
          className="flex items-baseline justify-between gap-3 border-dashed border-rule py-3 max-sm:border-b sm:block sm:pt-3.5 sm:pr-4 sm:pb-1.5 sm:not-first:border-l sm:not-first:pl-4"
        >
          <dt className="text-sm text-muted">{c.label}</dt>
          <dd className="font-mono text-2xl leading-tight font-semibold tracking-[-0.02em] text-ink md:text-[clamp(1.5rem,2.2vw,1.875rem)]">
            {c.value} <span className="font-sans text-sm font-normal tracking-normal whitespace-nowrap text-muted sm:block">{c.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// The progress bars need "now". Under Cache Components a bare `new Date()` fails the prerender of "/"
// (blocking-prerender-current-time); capturing it in a cached scope keeps "/" static and the time is the
// moment the entry was rendered, refreshed with the data (DESIGN-2 5.2). Same lifetimes as the lib:
// minutes, or seconds after a failed load so the fallback does not stick.
async function OpenActivities() {
  "use cache";
  let activities: PublicActivity[] | null;
  try {
    activities = await getOpenActivities();
  } catch {
    activities = null;
  }
  if (activities) cacheLife("minutes");
  else cacheLife("seconds");
  return <ActivitiesSection activities={activities} now={new Date()} />;
}

async function ActiveRewards() {
  let rewards: PublicReward[] | null;
  try {
    rewards = await getActiveRewards();
  } catch {
    rewards = null;
  }
  return <RewardsSection rewards={rewards} />;
}

async function LatestArticles() {
  let articles: PublicArticleSummary[] | null;
  try {
    articles = await listPublishedArticles();
  } catch {
    articles = null;
  }
  return <ArticlesSection articles={articles} />;
}
