import Link from "next/link";
import { Suspense } from "react";
import { formatCount, formatKg, formatKgFromGrams, type PublicStats } from "@/lib/leaderboard/format";
import { getPublicStats } from "@/lib/leaderboard/public-stats";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold">Green Campus</h1>
      <p className="text-gray-600 dark:text-gray-400">ระบบจัดการขยะในวิทยาลัย</p>
      <Suspense fallback={<div aria-hidden="true" className="h-24 w-full max-w-md animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-900" />}>
        <PublicTotals />
      </Suspense>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800"
        >
          สมัครสมาชิก
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-gray-300 px-4 py-3 font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          เข้าสู่ระบบ
        </Link>
        <Link href="/articles" className="px-4 py-2 font-semibold text-green-700 underline">
          บทความ
        </Link>
      </div>
    </main>
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
  if (!stats) return <p className="text-sm text-gray-500">ยังโหลดสถิติรวมไม่ได้ในขณะนี้</p>;
  const cards = [
    { id: "stat-carbon", label: "carbon ที่ลดได้", value: formatKg(stats.carbonKg), unit: "กก. CO2e" },
    { id: "stat-waste", label: "น้ำหนักขยะที่เก็บ", value: formatKgFromGrams(stats.wasteGrams), unit: "กก." },
    { id: "stat-trees", label: "ต้นไม้ที่ปลูก", value: formatCount(stats.trees), unit: "ต้น" },
  ];
  return (
    <dl className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.id} data-testid={c.id} className="rounded-2xl border border-gray-200 p-3 dark:border-gray-800">
          <dt className="text-xs text-gray-600 dark:text-gray-400">{c.label}</dt>
          <dd className="text-lg font-semibold">
            {c.value} <span className="text-xs font-normal">{c.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
