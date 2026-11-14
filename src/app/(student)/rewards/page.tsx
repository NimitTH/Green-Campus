import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListToolbar, ListToolbarSkeleton } from "@/app/_components/list/list-toolbar";
import { isNarrowed, parseListParams } from "@/app/_components/list/list-params";
import { Pagination } from "@/app/_components/list/pagination";
import { loadClamped } from "@/app/_components/list/paging";
import { ListSkeleton } from "@/app/_components/skeletons";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { REWARD_CONFIG } from "@/lib/rewards/list-config";
import { cartItemCount, getBalance, listActiveRewardsPage } from "@/lib/rewards/queries";
import { RewardCard, RewardRow } from "./_components/reward-card";

export const metadata: Metadata = { title: "ของรางวัล | Green Campus" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function RewardsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="ของรางวัล" />
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <RewardGrid searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const number = new Intl.NumberFormat("th-TH");

async function RewardGrid({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/rewards");
  const isStudent = user.role === "student";
  const [{ params, result }, balance, inCart] = await Promise.all([
    // past the end (e.g. ?page=999 or the list shrank): the last page instead
    loadClamped(REWARD_CONFIG, parseListParams(REWARD_CONFIG, await searchParams), listActiveRewardsPage),
    isStudent ? getBalance(user.id) : Promise.resolve(null),
    isStudent ? cartItemCount(user.id) : Promise.resolve(0),
  ]);

  return (
    <>
      {isStudent ? (
        <Card tone="accent" className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p>
            แต้มของฉัน{" "}
            <strong data-testid="balance" className="font-mono text-2xl">
              {number.format(balance ?? 0)}
            </strong>{" "}
            แต้ม
          </p>
          {/* Rewards hub (spec 9.2): cart and orders are not in the bottom nav. */}
          <div className="flex items-center gap-2">
            <ButtonLink href="/orders" variant="quiet">
              ออเดอร์ของฉัน
            </ButtonLink>
            <Link
              href="/cart"
              aria-label={`ตะกร้า ${number.format(inCart)} ชิ้น`}
              data-testid="cart-link"
              className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-rule-strong bg-surface text-ink shadow-card hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
                <path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6" />
              </svg>
              {inCart > 0 ? (
                <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1 text-center font-mono text-xs font-semibold leading-5 text-on-accent">
                  {inCart > 99 ? "99+" : inCart}
                </span>
              ) : null}
            </Link>
          </div>
        </Card>
      ) : null}
      <Suspense fallback={<ListToolbarSkeleton />}>
        <ListToolbar base="/rewards" config={REWARD_CONFIG} placeholder="ค้นหารางวัล" />
      </Suspense>
      {result.total === 0 || result.items.length === 0 ? (
        isNarrowed(REWARD_CONFIG, params) ? (
          <EmptyState>
            <p>ไม่พบรายการที่ตรงกับคำค้น</p>
            <Link href="/rewards" className="mt-2 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4">
              ล้างการค้นหา
            </Link>
          </EmptyState>
        ) : (
          <EmptyState>ยังไม่มีของรางวัลที่เปิดให้แลก ลองกลับมาดูใหม่ภายหลัง</EmptyState>
        )
      ) : (
        <>
          {params.view === "list" ? (
            <ul className="divide-y divide-rule rounded-card border border-rule bg-surface shadow-sheet">
              {result.items.map((r) => (
                <RewardRow key={r.id} reward={r} isStudent={isStudent} />
              ))}
            </ul>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((r) => (
                <RewardCard key={r.id} reward={r} isStudent={isStudent} />
              ))}
            </ul>
          )}
          <Pagination base="/rewards" config={REWARD_CONFIG} state={params} total={result.total} />
        </>
      )}
    </>
  );
}
