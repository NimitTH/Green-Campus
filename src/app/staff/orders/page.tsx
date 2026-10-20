import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { isAdminRole } from "@/lib/auth/routes";
import { formatBangkok } from "@/lib/datetime";
import { isOrderOverdue, orderNumber, orderStatusLabelTh, orderStatusTone } from "@/lib/orders/format";
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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">ออเดอร์</h1>
        <Link href="/staff" className="text-sm text-green-700 underline">
          กลับ
        </Link>
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
          className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/30 dark:border-gray-700 dark:bg-gray-900"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
          ค้นหา
        </button>
      </form>

      {orders.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
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
    <li data-testid="staff-order" className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/orders/${order.id}`} className="font-mono text-lg font-bold tracking-wider hover:underline">
          {orderNumber(order.id)}
        </Link>
        <span data-testid="order-status">
          <Badge tone={orderStatusTone(order.status)}>{orderStatusLabelTh(order.status)}</Badge>
        </span>
      </div>
      <p className="mt-1 break-words">{order.studentName}</p>
      <ul className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        {order.lines.map((l, i) => (
          <li key={i} className="break-words">
            {l.name} × {number.format(l.qty)}
          </li>
        ))}
      </ul>
      <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span>สั่งเมื่อ {formatBangkok(order.createdAt)}</span>
        <span className="font-medium text-gray-900 dark:text-gray-100">{number.format(order.totalPoints)} แต้ม</span>
      </p>
      {order.status === "pending_pickup" ? (
        <>
          <p className={`mt-1 text-sm ${overdue ? "font-medium text-red-700" : "text-gray-600 dark:text-gray-400"}`}>
            {overdue ? "เลยกำหนดรับแล้ว " : "รับได้ถึง "}
            {formatBangkok(order.expiresAt)}
          </p>
          <OrderActions orderId={order.id} label={label} />
        </>
      ) : null}
    </li>
  );
}
