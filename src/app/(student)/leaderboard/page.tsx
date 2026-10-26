import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { formatKg } from "@/lib/leaderboard/format";
import { getLeaderboard, parsePeriod, type LeaderboardPeriod, type LeaderboardRow } from "@/lib/leaderboard/queries";

export const metadata: Metadata = { title: "อันดับ | Green Campus" };

const TABS: { period: LeaderboardPeriod; label: string; href: string }[] = [
  { period: "month", label: "เดือนนี้", href: "/leaderboard" },
  { period: "all", label: "ตลอดกาล", href: "/leaderboard?period=all" },
];

type Search = Promise<{ period?: string | string[] }>;

export default function LeaderboardPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-4">
        <PageHeader title="อันดับคาร์บอน" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Leaderboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Leaderboard({ searchParams }: { searchParams: Search }) {
  const period = parsePeriod((await searchParams).period);
  await requireUser(period === "all" ? "/leaderboard?period=all" : "/leaderboard");
  const rows = await getLeaderboard(period);

  return (
    <>
      <nav aria-label="ช่วงเวลา" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.period}
            href={t.href}
            aria-current={t.period === period ? "page" : undefined}
            className={
              t.period === period
                ? "inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
                : "inline-flex min-h-11 items-center rounded-full border border-rule-strong bg-surface px-4 text-sm text-ink hover:bg-accent-soft"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState>ยังไม่มีอันดับในช่วงนี้</EmptyState>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.rank}-${i}`}>
              {r.isMe && r.rank !== null && r.rank > 10 ? (
                <p aria-hidden="true" className="pb-2 text-center text-muted">
                  …
                </p>
              ) : null}
              <Row row={r} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <div
      data-testid={row.isMe ? "lb-me" : "lb-row"}
      className={`flex items-center gap-3 rounded-card border p-3 text-ink shadow-card ${
        row.isMe ? "border-accent bg-accent-soft" : "border-rule bg-surface"
      }`}
    >
      <span data-testid="lb-rank" className="w-8 shrink-0 text-center font-mono font-semibold">
        {row.rank ?? "-"}
      </span>
      <span className="min-w-0 flex-1 break-words">
        {row.displayName}
        {row.isMe ? <span className="ml-2 text-xs text-accent">(คุณ)</span> : null}
      </span>
      <span className="shrink-0 text-right font-mono font-semibold">
        {row.rank === null ? (
          <span className="font-sans text-sm font-normal text-muted">ยังไม่มีอันดับ</span>
        ) : (
          <>
            {formatKg(row.carbonKg)} <span className="text-xs font-normal">กก.</span>
          </>
        )}
      </span>
    </div>
  );
}
