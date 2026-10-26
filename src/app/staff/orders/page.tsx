import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { Button, ButtonLink, Card, PageHeader, inputClass } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { formatBangkok } from "@/lib/datetime";
import { isOrderOverdue, isOrderReady, orderNumber, orderStatusLabelTh, orderStatusTone } from "@/lib/orders/format";
import { listStaffOrders, type StaffOrder } from "@/lib/orders/queries";
import { ExpireButton } from "./_components/expire-button";
import { OrderActions } from "./_components/order-actions";

export const metadata: Metadata = { title: "ออเดอร์ | Green Campus" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const number = new Intl.NumberFormat("th-TH");

// cacheComponents: searchParams and the session are request-time data, read them inside <Suspense>.
export default function StaffOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6">
        <PageHeader
          title="ออเดอร์"
          actions={
            <ButtonLink href="/staff" variant="quiet">
              กลับ
            </ButtonLink>
          }
        />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Orders({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaff("/staff/orders");
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const orders = await listStaffOrders(query);

  return (
    <>
      {isAdminRole(user.role) ? <ExpireButton /> : null}

      <form role="search" method="get" className="mb-4 flex gap-2">
        <label htmlFor="q" className="sr-only">
          ค้นหา
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="ชื่อนักเรียน หรือเลขที่ออเดอร์"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <Button type="submit" variant="primary" className="shrink-0">
          ค้นหา
        </Button>
      </form>

      {orders.length === 0 ? (
        <section className="rounded-card border border-dashed border-rule-strong p-6 text-center text-muted">
          {query ? "ไม่พบออเดอร์ที่ตรงกับคำค้น" : "ยังไม่มีออเดอร์"}
        </section>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} overdue={isOrderOverdue(o.status, o.expiresAt)} />
          ))}
        </ul>
      )}
    </>
  );
}

function OrderRow({ order, overdue }: { order: StaffOrder; overdue: boolean }) {
  const label = `ออเดอร์ ${orderNumber(order.id)}`;
  return (
    <Card as="li" data-testid="staff-order">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/orders/${order.id}`} className="font-mono text-lg font-bold tracking-wider text-ink hover:underline">
          {orderNumber(order.id)}
        </Link>
        <span data-testid="order-status">
          <Badge tone={orderStatusTone(order.status, order.readyAt)}>{orderStatusLabelTh(order.status, order.readyAt)}</Badge>
        </span>
      </div>
      <p className="mt-1 break-words">{order.studentName}</p>
      <ul className="mt-1 text-sm text-ink">
        {order.lines.map((l, i) => (
          <li key={i} className="break-words">
            {l.name} × {number.format(l.qty)}
          </li>
        ))}
      </ul>
      <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-muted">
        <span>สั่งเมื่อ {formatBangkok(order.createdAt)}</span>
        <span className="font-medium text-ink">
          <span className="font-mono">{number.format(order.totalPoints)}</span> แต้ม
        </span>
      </p>
      {order.status === "pending_pickup" ? (
        <>
          <p className={`mt-1 text-sm ${overdue ? "font-medium text-danger" : "text-muted"}`}>
            {overdue ? "เลยกำหนดรับแล้ว " : "รับได้ถึง "}
            {formatBangkok(order.expiresAt)}
          </p>
          <OrderActions orderId={order.id} label={label} ready={isOrderReady(order.status, order.readyAt)} />
        </>
      ) : null}
    </Card>
  );
}
