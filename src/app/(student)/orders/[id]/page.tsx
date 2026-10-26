import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { buttonClass, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { formatBangkok } from "@/lib/datetime";
import { isOrderOverdue, isOrderReady, orderNumber, orderStatusLabelTh, orderStatusTone, OVERDUE_NOTICE_TH } from "@/lib/orders/format";
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
  // still pending_pickup but past expires_at: expire_orders (hourly) will release it and refund
  const overdue = isOrderOverdue(order.status, order.expiresAt);
  const staff = isStaffRole(user.role);

  return (
    <article className="space-y-5">
      {/* Back to where the viewer came from: staff manage orders on /staff/orders. */}
      <Link href={staff ? "/staff/orders" : "/orders"} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {staff ? "← ออเดอร์ทั้งหมด (ครู)" : "← ออเดอร์ของฉัน"}
      </Link>
      <Card tone="accent" className="text-center">
        <p className="text-sm text-muted">เลขที่ออเดอร์ (แสดงที่แผนกตอนรับของ)</p>
        <h1 data-testid="order-number" className="font-mono text-4xl font-bold tracking-widest break-all">
          {orderNumber(order.id)}
        </h1>
        <p className="mt-2" data-testid="order-status">
          <Badge tone={orderStatusTone(order.status, order.readyAt)}>{orderStatusLabelTh(order.status, order.readyAt)}</Badge>
        </p>
        {staff && order.studentName ? <p className="mt-2 text-sm break-words">{order.studentName}</p> : null}
      </Card>

      {pending && overdue ? (
        <p data-testid="order-overdue" className="rounded-input border border-warn bg-surface p-3 text-sm text-warn">
          {OVERDUE_NOTICE_TH}
        </p>
      ) : pending ? (
        <p className="rounded-input border border-warn bg-surface p-3 text-sm text-warn">
          {isOrderReady(order.status, order.readyAt) ? "ของพร้อมแล้ว รับที่แผนกก่อนวันที่" : "รับของที่แผนกก่อนวันที่"}{" "}
          {formatBangkok(order.expiresAt)} ถ้าไม่มารับ ออเดอร์จะหมดอายุและได้แต้มคืน
        </p>
      ) : null}

      <section aria-label="รายการของรางวัล">
        <Card flush className="overflow-hidden">
        <ul className="divide-y divide-rule">
          {order.lines.map((l) => (
            <li key={l.rewardId} data-testid="order-item" className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium break-words">{l.name}</p>
                <p className="text-sm text-muted">
                  <span className="font-mono">{number.format(l.qty)}</span> ชิ้น × <span className="font-mono">{number.format(l.unitCost)}</span> แต้ม
                </p>
              </div>
              <p className="shrink-0 font-semibold">
                <span className="font-mono">{number.format(l.qty * l.unitCost)}</span> แต้ม
              </p>
            </li>
          ))}
        </ul>
        </Card>
        <p className="mt-3 flex justify-between px-1">
          <span>รวมทั้งหมด</span>
          <strong data-testid="order-total">
            <span className="font-mono">{number.format(order.totalPoints)}</span> แต้ม
          </strong>
        </p>
      </section>

      <dl className="space-y-1 text-sm text-muted">
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

      {/* Task 14: the PDF receipt, for every status (a plain link: the route answers with an attachment). */}
      <a
        href={`/api/receipts/${order.id}`}
        download
        className={buttonClass({ variant: "card", size: "lg", className: "w-full" })}
      >
        ดาวน์โหลดใบเสร็จ
      </a>
    </article>
  );
}
