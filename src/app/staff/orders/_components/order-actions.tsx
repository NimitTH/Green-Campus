"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
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
          className="rounded-input border border-danger p-3"
        >
          <p className="mb-3 text-sm text-danger">ยกเลิกออเดอร์นี้? ระบบจะคืนสต็อกและคืนแต้มให้นักเรียน</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" disabled={pending} onClick={() => run(() => cancelOrder(orderId))}>
              {pending ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
            </Button>
            <Button type="button" variant="card" disabled={pending} onClick={() => setConfirming(false)}>
              ไม่ยกเลิก
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ready ? null : (
            <Button type="button" variant="card" disabled={pending} onClick={() => run(() => markOrderReady(orderId))}>
              {pending ? "กำลังบันทึก..." : "เตรียมของเสร็จแล้ว"}
            </Button>
          )}
          <Button type="button" variant="primary" disabled={pending} onClick={() => run(() => completeOrder(orderId))}>
            {pending ? "กำลังบันทึก..." : "ยืนยันรับแล้ว"}
          </Button>
          <Button type="button" variant="danger" disabled={pending} onClick={() => setConfirming(true)}>
            ยกเลิก
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
