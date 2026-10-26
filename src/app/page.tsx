import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { formatCount, formatKg, formatKgFromGrams, type PublicStats } from "@/lib/leaderboard/format";
import { getPublicStats } from "@/lib/leaderboard/public-stats";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-1 md:px-6 xl:px-10">
        <Link href="/" className="py-2 font-display text-lg font-semibold text-accent">
          Green Campus
        </Link>
        <ThemeToggle compact />
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-10 px-4 py-18 md:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-30 xl:px-10">
        <div className="flex flex-col items-start gap-6">
          <h1 className="font-display text-[clamp(2.25rem,4vw+1rem,3.75rem)] leading-tight font-semibold text-ink">Green Campus</h1>
          <p className="max-w-[65ch] text-lg text-muted">ระบบจัดการขยะในวิทยาลัย</p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Link href="/register" className={buttonClass({ variant: "primary", size: "lg" })}>
              สมัครสมาชิก
            </Link>
            <Link href="/login" className={buttonClass({ variant: "card", size: "lg" })}>
              เข้าสู่ระบบ
            </Link>
            <Link href="/articles" className={buttonClass({ variant: "quiet" })}>
              บทความ
            </Link>
          </div>
        </div>
        <Suspense fallback={<div aria-hidden="true" className="h-40 w-full animate-pulse rounded-card bg-paper-2 motion-reduce:animate-none" />}>
          <PublicTotals />
        </Suspense>
      </main>
    </div>
  );
}

// Whole-school totals, no names. A failed load leaves a quiet line and the buttons still render.
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
  // Styled as a field-log card: ruled lines between entries, mono figures.
  return (
    <dl className="w-full divide-y divide-rule overflow-hidden rounded-card border border-rule bg-surface shadow-cast">
      {cards.map((c) => (
        <div key={c.id} data-testid={c.id} className="flex flex-col gap-1 p-4 md:px-6 md:py-5">
          <dt className="text-sm text-muted">{c.label}</dt>
          <dd className="font-mono text-3xl leading-tight font-semibold text-ink">
            {c.value} <span className="font-sans text-sm font-normal text-muted">{c.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
