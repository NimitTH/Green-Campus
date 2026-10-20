import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/app/_components/page-skeleton";
import { requireUser } from "@/lib/auth/dal";
import { cartTotal, getBalance, listCartLines } from "@/lib/rewards/queries";
import { CartLine } from "./cart-line";

export const metadata: Metadata = { title: "ตะกร้า | Green Campus" };

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold">ตะกร้า</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Cart />
      </Suspense>
    </main>
  );
}

const number = new Intl.NumberFormat("th-TH");

async function Cart() {
  const user = await requireUser("/cart");
  if (user.role !== "student") {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        เฉพาะบัญชีนักเรียนเท่านั้นที่ใช้ตะกร้าได้
      </section>
    );
  }
  const [lines, balance] = await Promise.all([listCartLines(user.id), getBalance(user.id)]);

  if (lines.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        <p>ตะกร้าว่าง</p>
        <Link href="/rewards" className="mt-3 inline-block text-sm text-green-700 underline">
          ไปเลือกของรางวัล
        </Link>
      </section>
    );
  }

  const total = cartTotal(lines);
  return (
    <>
      <ul className="space-y-3">
        {lines.map((l) => (
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
      <section aria-label="สรุปตะกร้า" className="mt-5 space-y-1 rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
        <p className="flex justify-between">
          <span>รวมทั้งหมด</span>
          <strong data-testid="cart-total">{number.format(total)} แต้ม</strong>
        </p>
        <p className="flex justify-between text-sm">
          <span>แต้มของฉัน</span>
          <span data-testid="balance">{number.format(balance)} แต้ม</span>
        </p>
        {total > balance ? (
          <p role="alert" className="pt-1 text-sm font-medium text-red-700">
            แต้มไม่พอ ขาดอีก {number.format(total - balance)} แต้ม
          </p>
        ) : null}
        <p className="pt-1 text-xs text-gray-600 dark:text-gray-400">
          ตะกร้าไม่ได้กันสต็อกไว้ให้ ของอาจหมดก่อนยืนยันแลก
        </p>
      </section>
    </>
  );
}
