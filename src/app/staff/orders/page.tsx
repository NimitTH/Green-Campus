import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { formatBangkok } from "@/lib/datetime";
import { isOrderOverdue, isOrderReady, orderNumber, orderStatusLabelTh, orderStatusTone } from "@/lib/orders/format";
import { STAFF_ORDER_CONFIG } from "@/lib/orders/list-config";
import { listStaffOrdersPage, type StaffOrder } from "@/lib/orders/queries";
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
      <Suspense fallback={<ListSkeleton view="list" toolbar={{ views: false, filters: 1 }} thumb={false} />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Orders({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaff("/staff/orders");
  const { params, result } = await loadClamped(STAFF_ORDER_CONFIG, parseListParams(STAFF_ORDER_CONFIG, await searchParams), listStaffOrdersPage);

  return (
    <>
      {isAdminRole(user.role) ? <ExpireButton /> : null}

      <Suspense fallback={<ListToolbarSkeleton views={false} filters={1} />}>
        <ListToolbar base="/staff/orders" config={STAFF_ORDER_CONFIG} placeholder="ชื่อนักเรียน หรือเลขที่ออเดอร์" />
      </Suspense>

      {result.items.length === 0 ? (
        isNarrowed(STAFF_ORDER_CONFIG, params) ? (
          <EmptyState>
            <p>ไม่พบรายการที่ตรงกับคำค้น</p>
            <Link href="/staff/orders" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
              ล้างการค้นหา
            </Link>
          </EmptyState>
        ) : (
          <EmptyState>ยังไม่มีออเดอร์ที่รอรับ</EmptyState>
        )
      ) : (
        <>
          <ul className="space-y-3">
            {result.items.map((o) => (
              <OrderRow key={o.id} order={o} overdue={isOrderOverdue(o.status, o.expiresAt)} />
            ))}
          </ul>
          <Pagination base="/staff/orders" config={STAFF_ORDER_CONFIG} state={params} total={result.total} />
        </>
      )}
    </>
  );
}

function OrderRow({ order, overdue }: { order: StaffOrder; overdue: boolean }) {
  const label = `ออเดอร์ ${orderNumber(order.id)}`;
  return (
    <Card as="li" data-testid="staff-order">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/orders/${order.id}`} className="font-mono text-lg font-bold tracking-wider text-ink hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center">
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
