import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/app/_components/activity-ui";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { RewardImage } from "@/app/_components/reward-image";
import { requireUser } from "@/lib/auth/dal";
import { getBalance, listActiveRewards } from "@/lib/rewards/queries";
import { AddToCartButton } from "./add-to-cart-button";

export const metadata: Metadata = { title: "ของรางวัล | Green Campus" };

export default function RewardsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">ของรางวัล</h1>
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
  const [rewards, balance] = await Promise.all([listActiveRewards(), isStudent ? getBalance(user.id) : Promise.resolve(null)]);

  return (
    <>
      {isStudent ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <p>
            แต้มของฉัน <strong data-testid="balance" className="text-lg">{number.format(balance ?? 0)}</strong> แต้ม
          </p>
          <Link href="/cart" className="text-sm font-semibold text-green-700 underline">
            ดูตะกร้า
          </Link>
        </div>
      ) : null}
      {rewards.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีของรางวัลที่เปิดให้แลก ลองกลับมาดูใหม่ภายหลัง
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <li key={r.id} data-testid="reward-card" className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
              <RewardImage url={r.imageUrl} className="h-40 w-full" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="font-semibold break-words">{r.name}</h2>
                <p className="text-green-700">{number.format(r.points_cost)} แต้ม</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {r.stock > 0 ? `เหลือ ${number.format(r.stock)} ชิ้น` : <Badge tone="amber">หมดแล้ว</Badge>}
                </p>
                {isStudent ? (
                  <div className="mt-auto pt-2">
                    <AddToCartButton rewardId={r.id} outOfStock={r.stock <= 0} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
