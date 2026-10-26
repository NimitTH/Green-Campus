import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { orderNumber, orderStatusLabelTh, orderStatusTone } from "@/lib/orders/format";
import { listMyOrders } from "@/lib/orders/queries";

export const metadata: Metadata = { title: "ออเดอร์ของฉัน | Green Campus" };

const number = new Intl.NumberFormat("th-TH");

export default function OrdersPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="ออเดอร์ของฉัน" />
      </div>
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
      <EmptyState>
        <p>ยังไม่มีออเดอร์</p>
        <ButtonLink href="/rewards" variant="card" className="mt-3">
          ไปเลือกของรางวัล
        </ButtonLink>
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} data-testid="order-row">
          <Link
            href={`/orders/${o.id}`}
            className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Card className="transition-colors hover:border-accent">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">
                เลขที่ <span className="font-mono">{orderNumber(o.id)}</span>
              </p>
              <span data-testid="order-status">
                <Badge tone={orderStatusTone(o.status, o.readyAt)}>{orderStatusLabelTh(o.status, o.readyAt)}</Badge>
              </span>
            </div>
            <p className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-muted">
              <span>{formatBangkok(o.createdAt)}</span>
              <span className="font-medium text-ink">
                <span className="font-mono">{number.format(o.totalPoints)}</span> แต้ม
              </span>
            </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
