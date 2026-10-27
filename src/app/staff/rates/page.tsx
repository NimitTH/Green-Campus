import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { listRates } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/dal";
import { RateCard } from "./_components/rate-form";

export const metadata: Metadata = { title: "อัตราแต้มและ carbon | Green Campus" };

// cacheComponents: the session is request-time data, read it inside <Suspense>.
export default function StaffRatesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="อัตราแต้มและ carbon"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <p data-testid="rates-note" className="mb-4 rounded-input border border-warn bg-surface p-3 text-sm text-ink">
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
      <EmptyState>ยังไม่มีกลุ่มขยะ</EmptyState>
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
