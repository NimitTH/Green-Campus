"use client";

import { useState, useTransition } from "react";
import { removeFromCart, setCartQty } from "@/app/actions/cart";
import { RewardImage } from "@/app/_components/reward-image";
import { Button, Card } from "@/components/ui";
import { MAX_CART_QTY } from "@/lib/rewards/validation";

const number = new Intl.NumberFormat("th-TH");
const stepperClass = "min-w-11";

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
    <Card as="li" data-testid="cart-line">
      <div className="flex gap-3">
        <RewardImage url={reward?.imageUrl ?? null} className="size-16 shrink-0 rounded-input" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold break-words">{name}</h2>
          {reward ? (
            <p className="text-sm text-muted">
              <span className="font-mono">{number.format(reward.pointsCost)}</span> แต้มต่อชิ้น
            </p>
          ) : (
            <p className="text-sm text-warn">ของรางวัลนี้ไม่เปิดให้แลกแล้ว ลบออกจากตะกร้าได้</p>
          )}
        </div>
        {reward ? (
          <p className="shrink-0 font-semibold" aria-label="ยอดรวมรายการ">
            <span className="font-mono">{number.format(qty * reward.pointsCost)}</span> แต้ม
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {reward ? (
          <>
            <Button type="button" aria-label="ลดจำนวน" disabled={pending} onClick={() => run(() => setCartQty(rewardId, qty - 1))} className={stepperClass}>
              −
            </Button>
            <output data-testid="cart-qty" aria-label="จำนวน" className="min-w-8 text-center font-mono text-lg">
              {qty}
            </output>
            <Button
              type="button"
              aria-label="เพิ่มจำนวน"
              disabled={pending || qty >= MAX_CART_QTY}
              onClick={() => run(() => setCartQty(rewardId, qty + 1))}
              className={stepperClass}
            >
              +
            </Button>
          </>
        ) : null}
        <Button type="button" variant="danger" aria-label="เอาออกจากตะกร้า" disabled={pending} onClick={remove} className="ml-auto">
          ลบ
        </Button>
      </div>

      {reward && qty > reward.stock ? (
        <p className="mt-2 text-sm text-warn">
          สต็อกเหลือ <span className="font-mono">{number.format(reward.stock)}</span> ชิ้น
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
