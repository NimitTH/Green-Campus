"use client";

import { useRef, useState, useTransition } from "react";
import { checkoutCart } from "@/app/actions/orders";
import { blockedReasonTh, type BlockedItem } from "@/lib/orders/format";

/**
 * "ยืนยันแลก": redeems the whole cart (checkout(), all or nothing). Disabled while the cart cannot
 * be redeemed; a ref blocks a second tap before React re-renders the disabled state.
 */
export function CheckoutButton({ disabled, names }: { disabled: boolean; names: Record<string, string> }) {
  const [pending, startTransition] = useTransition();
  const running = useRef(false);
  const [error, setError] = useState<{ message: string; blocked: BlockedItem[] } | null>(null);

  function submit() {
    if (running.current || disabled) return;
    running.current = true;
    setError(null);
    startTransition(async () => {
      try {
        // On success the action redirects to /orders/<id>, so only failures come back.
        const result = await checkoutCart();
        if (result) setError({ message: result.error, blocked: result.blocked });
      } finally {
        running.current = false;
      }
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={submit}
        disabled={disabled || pending}
        className="w-full rounded-lg bg-green-700 px-4 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "กำลังแลก..." : "ยืนยันแลก"}
      </button>
      {error ? (
        <div
          role="alert"
          data-testid="checkout-blocked"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <p className="font-medium">{error.message}</p>
          {error.blocked.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {error.blocked.map((b, i) => (
                <li key={`${b.reward_id ?? "points"}-${i}`}>{blockedReasonTh(b, b.reward_id ? names[b.reward_id] : undefined)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
