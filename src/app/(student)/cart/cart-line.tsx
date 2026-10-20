"use client";

import { useState, useTransition } from "react";
import { removeFromCart, setCartQty } from "@/app/actions/cart";
import { RewardImage } from "@/app/_components/reward-image";
import { MAX_CART_QTY } from "@/lib/rewards/validation";

const number = new Intl.NumberFormat("th-TH");
const stepperClass =
  "h-10 w-10 rounded-lg border border-gray-300 text-lg disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700";

export type CartLineView = {
  rewardId: string;
  qty: number;
  /** null: the reward is no longer open for redemption (the line can only be removed). */
  reward: { name: string; pointsCost: number; stock: number; imageUrl: string | null } | null;
};

/** One cart line with a quantity stepper. The cart does not reserve stock, it only warns. */
export function CartLine({ line }: { line: CartLineView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { reward, qty, rewardId } = line;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? null);
    });
  }

  const remove = () => run(() => removeFromCart(rewardId));
  const name = reward?.name ?? "ของรางวัลที่ปิดการแลกแล้ว";

  return (
    <li data-testid="cart-line" className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex gap-3">
        <RewardImage url={reward?.imageUrl ?? null} className="h-16 w-16 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold break-words">{name}</h2>
          {reward ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">{number.format(reward.pointsCost)} แต้มต่อชิ้น</p>
          ) : (
            <p className="text-sm text-amber-700">ของรางวัลนี้ไม่เปิดให้แลกแล้ว ลบออกจากตะกร้าได้</p>
          )}
        </div>
        {reward ? (
          <p className="shrink-0 font-semibold" aria-label="ยอดรวมรายการ">
            {number.format(qty * reward.pointsCost)} แต้ม
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {reward ? (
          <>
            <button type="button" aria-label="ลดจำนวน" disabled={pending} onClick={() => run(() => setCartQty(rewardId, qty - 1))} className={stepperClass}>
              −
            </button>
            <output data-testid="cart-qty" aria-label="จำนวน" className="min-w-8 text-center text-lg">
              {qty}
            </output>
            <button
              type="button"
              aria-label="เพิ่มจำนวน"
              disabled={pending || qty >= MAX_CART_QTY}
              onClick={() => run(() => setCartQty(rewardId, qty + 1))}
              className={stepperClass}
            >
              +
            </button>
          </>
        ) : null}
        <button
          type="button"
          aria-label="เอาออกจากตะกร้า"
          disabled={pending}
          onClick={remove}
          className="ml-auto rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          ลบ
        </button>
      </div>

      {reward && qty > reward.stock ? (
        <p className="mt-2 text-sm text-amber-700">สต็อกเหลือ {number.format(reward.stock)} ชิ้น</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </li>
  );
}
