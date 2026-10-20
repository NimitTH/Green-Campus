"use client";

import { useRef, useState, useTransition } from "react";
import { cancelOrder, completeOrder, markOrderReady, type OrderActionResult } from "@/app/actions/orders";

/**
 * "เตรียมของเสร็จแล้ว" (only while not ready), "ยืนยันรับแล้ว" and a two-step "ยกเลิก" for one pending
 * order. All lock while any runs. A pending order that is not ready can still be completed directly.
 */
export function OrderActions({ orderId, label, ready }: { orderId: string; label: string; ready: boolean }) {
  const [pending, startTransition] = useTransition();
  const running = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<OrderActionResult>) {
    if (running.current) return;
    running.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.error);
        else setConfirming(false);
      } finally {
        running.current = false;
      }
    });
  }

  return (
    <div className="mt-3 space-y-2">
      {confirming ? (
        <div
          role="group"
          aria-label={`ยืนยันการยกเลิก ${label}`}
          className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950"
        >
          <p className="mb-3 text-sm text-red-800 dark:text-red-200">ยกเลิกออเดอร์นี้? ระบบจะคืนสต็อกและคืนแต้มให้นักเรียน</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelOrder(orderId))}
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
            >
              ไม่ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ready ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => markOrderReady(orderId))}
              className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-60 dark:text-green-300 dark:hover:bg-green-950"
            >
              {pending ? "กำลังบันทึก..." : "เตรียมของเสร็จแล้ว"}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => completeOrder(orderId))}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            {pending ? "กำลังบันทึก..." : "ยืนยันรับแล้ว"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
          >
            ยกเลิก
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
