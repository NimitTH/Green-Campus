import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { listRates } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { RateCard } from "./_components/rate-form";

export const metadata: Metadata = { title: "อัตราแต้มและ carbon | Green Campus" };

// cacheComponents: the session is request-time data, read it inside <Suspense>.
export default function StaffRatesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">อัตราแต้มและ carbon</h1>
        <Link href="/staff" className="text-sm text-green-700 underline">
          กลับ
        </Link>
      </div>
      <p data-testid="rates-note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        การเปลี่ยนอัตราใช้กับผลที่อนุมัติหลังจากนี้เท่านั้น ผลที่อนุมัติไปแล้วไม่เปลี่ยน (แต้มและ carbon ถูกบันทึกไว้ตอนอนุมัติ)
      </p>
      <Suspense fallback={<PageSkeleton />}>
        <Rates />
      </Suspense>
    </main>
  );
}

async function Rates() {
  await requireAdmin("/staff/rates");
  const rates = await listRates();
  if (rates.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีกลุ่มขยะ
      </section>
    );
  }
  return (
    <div className="space-y-4">
      {rates.map((r) => (
        // keyed by id: the card and its saved message survive a save; the form inside is keyed by updated_at
        <RateCard
          key={r.id}
          id={r.id}
          code={r.code}
          updatedAt={r.updatedAt}
          initial={{
            name: r.name,
            pointsPerKg: String(r.pointsPerKg),
            carbonKgPerKg: String(r.carbonKgPerKg),
            sourceNote: r.sourceNote ?? "",
          }}
        />
      ))}
    </div>
  );
}
