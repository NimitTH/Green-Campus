import Link from "next/link";
import { getStaffStats } from "@/lib/admin/queries";
import { formatBangkok } from "@/lib/datetime";
import { formatCount, formatKg, formatKgFromGrams } from "@/lib/leaderboard/format";

const cardClass = "block rounded-2xl border border-gray-200 p-4 dark:border-gray-800";

/** R118: work waiting for staff and the whole-school totals, above the menu. */
export async function StaffStats() {
  let stats;
  try {
    stats = await getStaffStats();
  } catch (e) {
    console.error("StaffStats failed", e instanceof Error ? e.message : e);
    return (
      <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        ยังโหลดสรุปงานไม่ได้ในขณะนี้ รีเฟรชหน้าเพื่อลองใหม่
      </p>
    );
  }

  return (
    <section aria-label="สรุปงาน" className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/staff/reviews" data-testid="stat-pending-reviews" className={`${cardClass} hover:border-green-600`}>
          <span className="block text-sm text-gray-600 dark:text-gray-400">งานรอตรวจ</span>
          <span data-testid="stat-value" className="text-2xl font-semibold">
            {formatCount(stats.pendingReviews)}
          </span>{" "}
          <span className="text-sm">รายการ</span>
        </Link>
        <Link href="/staff/orders" data-testid="stat-pending-pickup" className={`${cardClass} hover:border-green-600`}>
          <span className="block text-sm text-gray-600 dark:text-gray-400">ออเดอร์รอรับ</span>
          <span data-testid="stat-value" className="text-2xl font-semibold">
            {formatCount(stats.pendingPickup)}
          </span>{" "}
          <span className="text-sm">ออเดอร์</span>
          <span className="block text-sm text-gray-600 dark:text-gray-400">
            พร้อมรับ <span data-testid="stat-ready">{formatCount(stats.readyForPickup)}</span>
          </span>
        </Link>
        <div data-testid="stat-totals" className={cardClass}>
          <span className="block text-sm text-gray-600 dark:text-gray-400">ยอดสะสมทั้งโรงเรียน</span>
          <dl className="mt-1 space-y-0.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt>carbon ที่ลดได้</dt>
              <dd className="font-semibold">{formatKg(stats.carbonKg)} กก.</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>ขยะที่เก็บ</dt>
              <dd className="font-semibold">{formatKgFromGrams(stats.wasteGrams)} กก.</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>ต้นไม้ที่ปลูก</dt>
              <dd className="font-semibold">{formatCount(stats.trees)} ต้น</dd>
            </div>
          </dl>
        </div>
      </div>
      <div data-testid="stat-open-activities" className={cardClass}>
        <h2 className="mb-2 text-sm text-gray-600 dark:text-gray-400">กิจกรรมที่เปิดอยู่</h2>
        {stats.openActivities.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">ยังไม่มีกิจกรรมที่เปิดรับ</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {stats.openActivities.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-3">
                <Link href={`/staff/activities/${a.id}/edit`} className="min-w-0 break-words font-medium text-green-800 underline dark:text-green-300">
                  {a.title}
                </Link>
                <span className="text-gray-600 dark:text-gray-400">สิ้นสุด {formatBangkok(a.endsAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
