import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { RewardImage } from "@/app/_components/reward-image";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { cartItemCount, getBalance, listActiveRewards } from "@/lib/rewards/queries";
import { AddToCartButton } from "./add-to-cart-button";

export const metadata: Metadata = { title: "ของรางวัล | Green Campus" };

export default function RewardsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div className="mb-5">
        <PageHeader title="ของรางวัล" />
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <RewardGrid />
      </Suspense>
    </main>
  );
}

const number = new Intl.NumberFormat("th-TH");

async function RewardGrid() {
  const user = await requireUser("/rewards");
  const isStudent = user.role === "student";
  const [rewards, balance, inCart] = await Promise.all([
    listActiveRewards(),
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
      {rewards.length === 0 ? (
        <EmptyState>ยังไม่มีของรางวัลที่เปิดให้แลก ลองกลับมาดูใหม่ภายหลัง</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <Card as="li" flush key={r.id} data-testid="reward-card" className="flex flex-col overflow-hidden">
              <RewardImage url={r.imageUrl} className="aspect-[4/3] w-full" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="font-semibold break-words">{r.name}</h2>
                <p className="text-accent">
                  <span className="font-mono">{number.format(r.points_cost)}</span> แต้ม
                </p>
                <p className="text-sm text-muted">
                  {r.stock > 0 ? (
                    <>
                      เหลือ <span className="font-mono">{number.format(r.stock)}</span> ชิ้น
                    </>
                  ) : (
                    <Badge tone="amber">หมดแล้ว</Badge>
                  )}
                </p>
                {isStudent ? (
                  <div className="mt-auto pt-2">
                    <AddToCartButton rewardId={r.id} outOfStock={r.stock <= 0} />
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
