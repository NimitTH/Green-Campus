import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
      <h1 className="mb-4 text-xl font-semibold">อันดับคาร์บอน</h1>
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
                ? "rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีอันดับในช่วงนี้
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.rank}-${i}`}>
              {r.isMe && r.rank !== null && r.rank > 10 ? (
                <p aria-hidden="true" className="pb-2 text-center text-gray-500">
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
      className={`flex items-center gap-3 rounded-2xl border p-3 ${
        row.isMe ? "border-green-600 bg-green-50 dark:bg-green-950" : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <span data-testid="lb-rank" className="w-8 shrink-0 text-center font-semibold">
        {row.rank ?? "-"}
      </span>
      <span className="min-w-0 flex-1 break-words">
        {row.displayName}
        {row.isMe ? <span className="ml-2 text-xs text-green-700 dark:text-green-400">(คุณ)</span> : null}
      </span>
      <span className="shrink-0 text-right font-semibold">
        {row.rank === null ? (
          <span className="text-sm font-normal text-gray-600 dark:text-gray-400">ยังไม่มีอันดับ</span>
        ) : (
          <>
            {formatKg(row.carbonKg)} <span className="text-xs font-normal">กก.</span>
          </>
        )}
      </span>
    </div>
  );
}
