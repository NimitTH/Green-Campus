"use client";

import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";
import { Button } from "@/components/ui";

/** "ใส่ตะกร้า" for one reward; disabled when it is out of stock. The cart does not reserve stock. */
export function AddToCartButton({ rewardId, outOfStock }: { rewardId: string; outOfStock: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function add() {
    setMessage(null);
    startTransition(async () => {
      const result = await addToCart(rewardId, 1);
      setMessage(result.ok ? { ok: true, text: "ใส่ตะกร้าแล้ว" } : { ok: false, text: result.error });
    });
  }

  return (
    <div>
      <Button type="button" variant="primary" onClick={add} disabled={outOfStock || pending} className="w-full">
        ใส่ตะกร้า
      </Button>
      {message?.ok ? (
        <p role="status" className="mt-2 text-sm text-accent">
          {message.text}
        </p>
      ) : null}
      {message && !message.ok ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
