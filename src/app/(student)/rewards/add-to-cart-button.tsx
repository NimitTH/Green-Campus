"use client";

import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";

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
      <button
        type="button"
        onClick={add}
        disabled={outOfStock || pending}
        className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-gray-800 dark:disabled:text-gray-400"
      >
        ใส่ตะกร้า
      </button>
      {message?.ok ? (
        <p role="status" className="mt-2 text-sm text-green-700">
          {message.text}
        </p>
      ) : null}
      {message && !message.ok ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
