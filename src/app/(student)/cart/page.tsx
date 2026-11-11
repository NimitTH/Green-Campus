import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { paginateRows, sortRows } from "@/app/_components/list/client-list";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { pageSizeOf, parseListParams } from "@/app/_components/list/list-params";
import { Pagination } from "@/app/_components/list/pagination";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { cartRemainder } from "@/lib/rewards/cart-summary";
import { CART_CONFIG } from "@/lib/rewards/list-config";
import { cartTotal, getBalance, listCartLines, type CartLine as CartLineData } from "@/lib/rewards/queries";
import { CartLine } from "./cart-line";
import { CheckoutButton } from "./checkout-button";

export const metadata: Metadata = { title: "ตะกร้า | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CartPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="ตะกร้า" />
      </div>
      <Suspense fallback={<ListSkeleton view="list" toolbar={false} />}>
        <Cart searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const number = new Intl.NumberFormat("th-TH");
const CLOSED_NAME = "ของรางวัลที่ปิดการแลกแล้ว";

const nameOf = (l: CartLineData) => (l.reward?.active ? l.reward.name : CLOSED_NAME);

// a closed reward has no price or line total: null sorts last in both directions
const SORT_KEYS: Record<keyof typeof CART_CONFIG.sorts, (l: CartLineData) => string | number | null> = {
  date: (l) => l.addedAt,
  price: (l) => (l.reward?.active ? l.reward.points_cost : null),
  total: (l) => (l.reward?.active ? l.qty * l.reward.points_cost : null),
  qty: (l) => l.qty,
  name: nameOf,
};

async function Cart({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/cart");
  if (user.role !== "student") {
    return (
      <EmptyState>เฉพาะบัญชีนักเรียนเท่านั้นที่ใช้ตะกร้าได้</EmptyState>
    );
  }
  const [lines, balance] = await Promise.all([listCartLines(user.id), getBalance(user.id)]);

  if (lines.length === 0) {
    return (
      <EmptyState>
        <p>ตะกร้าว่าง</p>
        <ButtonLink href="/rewards" variant="card" className="mt-3">
          ไปเลือกของรางวัล
        </ButtonLink>
      </EmptyState>
    );
  }

  // totals and the checkout rule use every line; only the list below is searched, sorted and paged
  const total = cartTotal(lines);
  const remainder = cartRemainder(balance, total);
  const params = parseListParams(CART_CONFIG, await searchParams);
  const needle = params.q.toLocaleLowerCase("th");
  const matched = needle ? lines.filter((l) => nameOf(l).toLocaleLowerCase("th").includes(needle)) : lines;
  const sortKey = params.sort as keyof typeof CART_CONFIG.sorts;
  const sorted = sortRows(matched, SORT_KEYS[sortKey], CART_CONFIG.sorts[sortKey].kind, params.dir);
  const pageData = paginateRows(sorted, params.page, pageSizeOf(CART_CONFIG));
  const state = { ...params, page: pageData.page };
  return (
    <>
      <Suspense fallback={<ListToolbarSkeleton views={false} />}>
        <ListToolbar base="/cart" config={CART_CONFIG} placeholder="ค้นหาในตะกร้า" />
      </Suspense>
      {matched.length === 0 ? (
        <EmptyState>
          <p>ไม่พบรายการที่ตรงกับคำค้น</p>
          <Link href="/cart" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
            ล้างการค้นหา
          </Link>
        </EmptyState>
      ) : null}
      <ul className="space-y-3">
        {pageData.items.map((l) => (
          <CartLine
            key={l.rewardId}
            line={{
              rewardId: l.rewardId,
              qty: l.qty,
              reward:
                l.reward && l.reward.active
                  ? { name: l.reward.name, pointsCost: l.reward.points_cost, stock: l.reward.stock, imageUrl: l.reward.imageUrl }
                  : null,
            }}
          />
        ))}
      </ul>
      <Pagination base="/cart" config={CART_CONFIG} state={state} total={matched.length} />
      <Card as="section" tone="accent" aria-label="สรุปตะกร้า" className="mt-5 space-y-1">
        <p className="flex justify-between">
          <span>รวมทั้งหมด</span>
          <strong data-testid="cart-total">
            <span className="font-mono">{number.format(total)}</span> แต้ม
          </strong>
        </p>
        <p className="flex justify-between text-sm">
          <span>แต้มของฉัน</span>
          <span data-testid="balance">
            <span className="font-mono">{number.format(balance)}</span> แต้ม
          </span>
        </p>
        <p
          role={remainder.kind === "short" ? "alert" : undefined}
          className={`pt-1 text-sm font-medium ${remainder.kind === "short" ? "text-warn" : "text-ink"}`}
        >
          แต้มที่มี <span className="font-mono">{number.format(balance)}</span> − แต้มรวม <span className="font-mono">{number.format(total)}</span> ={" "}
          {remainder.kind === "left" ? "เหลือ" : "ขาดอีก"} <span className="font-mono">{number.format(remainder.points)}</span> แต้ม
        </p>
        <p className="pt-1 text-xs text-muted">
          ตะกร้าไม่ได้กันสต็อกไว้ให้ ของอาจหมดก่อนยืนยันแลก
        </p>
      </Card>
      <CheckoutButton
        disabled={total > balance}
        names={Object.fromEntries(lines.map((l) => [l.rewardId, l.reward?.active ? l.reward.name : "ของรางวัลที่ปิดการแลกแล้ว"]))}
      />
    </>
  );
}
