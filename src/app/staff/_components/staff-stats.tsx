import Link from "next/link";
import { getStaffStats } from "@/lib/admin/queries";
import { Card, Stat } from "@/components/ui";
import { formatBangkok } from "@/lib/datetime";
import { formatCount, formatKg, formatKgFromGrams } from "@/lib/leaderboard/format";

const linkCardClass =
  "block rounded-card border border-rule bg-surface p-4 text-ink shadow-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:p-6";

/** R118: work waiting for staff and the whole-school totals, above the menu. */
export async function StaffStats() {
  let stats;
  try {
    stats = await getStaffStats();
  } catch (e) {
    console.error("StaffStats failed", e instanceof Error ? e.message : e);
    return (
      <p role="alert" className="mb-4 rounded-input border border-warn p-3 text-sm text-warn">
        ยังโหลดสรุปงานไม่ได้ในขณะนี้ รีเฟรชหน้าเพื่อลองใหม่
      </p>
    );
  }

  return (
    <section aria-label="สรุปงาน" className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/staff/reviews" data-testid="stat-pending-reviews" className={linkCardClass}>
          <Stat label="งานรอตรวจ" size="lg" data-testid="stat-value">
            {formatCount(stats.pendingReviews)}
          </Stat>
          <span className="text-sm text-muted">รายการ</span>
        </Link>
        <Link href="/staff/orders" data-testid="stat-pending-pickup" className={linkCardClass}>
          <Stat label="ออเดอร์รอรับ" size="lg" data-testid="stat-value">
            {formatCount(stats.pendingPickup)}
          </Stat>
          <span className="text-sm text-muted">ออเดอร์</span>
          <span className="block text-sm text-muted">
            พร้อมรับ{" "}
            <span data-testid="stat-ready" className="font-mono">
              {formatCount(stats.readyForPickup)}
            </span>
          </span>
        </Link>
        <Card data-testid="stat-totals">
          <span className="block text-sm text-muted">ยอดสะสมทั้งโรงเรียน</span>
          <dl className="mt-1 space-y-0.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt>carbon ที่ลดได้</dt>
              <dd className="font-semibold">
                <span className="font-mono">{formatKg(stats.carbonKg)}</span> กก.
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>ขยะที่เก็บ</dt>
              <dd className="font-semibold">
                <span className="font-mono">{formatKgFromGrams(stats.wasteGrams)}</span> กก.
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>ต้นไม้ที่ปลูก</dt>
              <dd className="font-semibold">
                <span className="font-mono">{formatCount(stats.trees)}</span> ต้น
              </dd>
            </div>
          </dl>
        </Card>
      </div>
      <Card data-testid="stat-open-activities">
        <h2 className="mb-2 text-sm text-muted">กิจกรรมที่เปิดอยู่</h2>
        {stats.openActivities.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีกิจกรรมที่เปิดรับ</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stats.openActivities.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-3">
                <Link href={`/staff/activities/${a.id}/edit`} className="min-w-0 break-words font-medium text-accent underline">
                  {a.title}
                </Link>
                <span className="text-muted">สิ้นสุด {formatBangkok(a.endsAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
