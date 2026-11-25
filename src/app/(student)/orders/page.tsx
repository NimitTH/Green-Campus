import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { formatBangkok } from "@/lib/datetime";
import { orderNumber, orderStatusLabelTh, orderStatusTone } from "@/lib/orders/format";
import { MY_ORDER_CONFIG } from "@/lib/orders/list-config";
import { listMyOrdersPage } from "@/lib/orders/queries";

export const metadata: Metadata = { title: "ออเดอร์ของฉัน | Green Campus" };

const number = new Intl.NumberFormat("th-TH");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="ออเดอร์ของฉัน" />
      </div>
      <Suspense fallback={<ListToolbarSkeleton views={false} />}>
        <ListToolbar base="/orders" config={MY_ORDER_CONFIG} placeholder="ค้นหาสินค้าหรือเลขที่ออเดอร์" />
      </Suspense>
      <Suspense fallback={<ListSkeleton view="list" toolbar={false} />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Orders({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/orders");
  // past the end (e.g. ?page=999 or the list shrank): the last page instead
  const { params, result } = await loadClamped(MY_ORDER_CONFIG, parseListParams(MY_ORDER_CONFIG, await searchParams), (p) => listMyOrdersPage(user.id, p));
  const orders = result.items;

  if (orders.length === 0) {
    if (isNarrowed(MY_ORDER_CONFIG, params)) {
      return (
        <EmptyState>
          <p>ไม่พบรายการที่ตรงกับคำค้น</p>
          <Link href="/orders" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
            ล้างการค้นหา
          </Link>
        </EmptyState>
      );
    }
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
    <>
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id} data-testid="order-row" data-order-id={o.id}>
            <Link
              href={`/orders/${o.id}`}
              className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Card className="transition-colors hover:border-accent">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">
                    เลขที่ <span className="font-mono">{orderNumber(o)}</span>
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
      <Pagination base="/orders" config={MY_ORDER_CONFIG} state={params} total={result.total} />
    </>
  );
}
