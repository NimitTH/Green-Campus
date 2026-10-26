"use client";

import { useRef, useState, useTransition } from "react";
import { checkoutCart } from "@/app/actions/orders";
import { Button } from "@/components/ui";
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
      <Button type="button" variant="primary" size="lg" onClick={submit} disabled={disabled || pending} className="w-full">
        {pending ? "กำลังแลก..." : "ยืนยันแลก"}
      </Button>
      {error ? (
        <div
          role="alert"
          data-testid="checkout-blocked"
          className="mt-3 rounded-input border border-danger bg-surface p-3 text-sm text-danger"
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
