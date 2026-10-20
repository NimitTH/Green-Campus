import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { orderNumber, orderStatusLabelTh, orderStatusTone } from "@/lib/orders/format";
import { listMyOrders } from "@/lib/orders/queries";

export const metadata: Metadata = { title: "ออเดอร์ของฉัน | Green Campus" };

const number = new Intl.NumberFormat("th-TH");

export default function OrdersPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">ออเดอร์ของฉัน</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Orders />
      </Suspense>
    </main>
  );
}

async function Orders() {
  const user = await requireUser("/orders");
  const orders = await listMyOrders(user.id);

  if (orders.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        <p>ยังไม่มีออเดอร์</p>
        <Link href="/rewards" className="mt-3 inline-block text-sm text-green-700 underline">
          ไปเลือกของรางวัล
        </Link>
      </section>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} data-testid="order-row">
          <Link
            href={`/orders/${o.id}`}
            className="block rounded-2xl border border-gray-200 p-4 hover:border-green-600 dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono font-semibold">เลขที่ {orderNumber(o.id)}</p>
              <span data-testid="order-status">
                <Badge tone={orderStatusTone(o.status)}>{orderStatusLabelTh(o.status)}</Badge>
              </span>
            </div>
            <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{formatBangkok(o.createdAt)}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{number.format(o.totalPoints)} แต้ม</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
