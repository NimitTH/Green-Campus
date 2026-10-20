import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { formatBangkok } from "@/lib/datetime";
import { isOrderReady, orderNumber, orderStatusLabelTh, orderStatusTone } from "@/lib/orders/format";
import { getOrder } from "@/lib/orders/queries";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "ออเดอร์ | Green Campus" };

const number = new Intl.NumberFormat("th-TH");

// cacheComponents: params and the session are request-time data, read them inside <Suspense>.
export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <Suspense fallback={<PageSkeleton />}>
        <Order params={params} />
      </Suspense>
    </main>
  );
}

async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/orders/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();
  // RLS: only the owner or staff can read the order; anyone else gets null -> 404.
  const order = await getOrder(id);
  if (!order) notFound();
  const pending = order.status === "pending_pickup";
  const staff = isStaffRole(user.role);

  return (
    <article className="space-y-5">
      {/* Back to where the viewer came from: staff manage orders on /staff/orders. */}
      <Link href={staff ? "/staff/orders" : "/orders"} className="inline-block text-sm text-green-700 underline">
        {staff ? "← ออเดอร์ทั้งหมด (ครู)" : "← ออเดอร์ของฉัน"}
      </Link>
      <header className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950">
        <p className="text-sm text-gray-600 dark:text-gray-400">เลขที่ออเดอร์ (แสดงที่แผนกตอนรับของ)</p>
        <h1 data-testid="order-number" className="font-mono text-4xl font-bold tracking-widest break-all">
          {orderNumber(order.id)}
        </h1>
        <p className="mt-2" data-testid="order-status">
          <Badge tone={orderStatusTone(order.status, order.readyAt)}>{orderStatusLabelTh(order.status, order.readyAt)}</Badge>
        </p>
        {staff && order.studentName ? <p className="mt-2 text-sm break-words">{order.studentName}</p> : null}
      </header>

      {pending ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {isOrderReady(order.status, order.readyAt) ? "ของพร้อมแล้ว รับที่แผนกก่อนวันที่" : "รับของที่แผนกก่อนวันที่"}{" "}
          {formatBangkok(order.expiresAt)} ถ้าไม่มารับ ออเดอร์จะหมดอายุและได้แต้มคืน
        </p>
      ) : null}

      <section aria-label="รายการของรางวัล">
        <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {order.lines.map((l) => (
            <li key={l.rewardId} data-testid="order-item" className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium break-words">{l.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {number.format(l.qty)} ชิ้น × {number.format(l.unitCost)} แต้ม
                </p>
              </div>
              <p className="shrink-0 font-semibold">{number.format(l.qty * l.unitCost)} แต้ม</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between px-1">
          <span>รวมทั้งหมด</span>
          <strong data-testid="order-total">{number.format(order.totalPoints)} แต้ม</strong>
        </p>
      </section>

      <dl className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex justify-between gap-3">
          <dt>สั่งเมื่อ</dt>
          <dd>{formatBangkok(order.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>หมดอายุ</dt>
          <dd>{formatBangkok(order.expiresAt)}</dd>
        </div>
        {order.completedAt ? (
          <div className="flex justify-between gap-3">
            <dt>รับของเมื่อ</dt>
            <dd>{formatBangkok(order.completedAt)}</dd>
          </div>
        ) : null}
      </dl>

      {/* Task 14: the PDF receipt download goes here. */}
      <div data-slot="receipt" />
    </article>
  );
}
