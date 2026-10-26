"use client";

import { useRef, useState, useTransition } from "react";
import { expireDueOrders } from "@/app/actions/orders";
import { Button } from "@/components/ui";

const number = new Intl.NumberFormat("th-TH");

/** Admin only (the page renders it for admins): runs expire_orders() now, like the hourly pg_cron job. */
export function ExpireButton() {
  const [pending, startTransition] = useTransition();
  const running = useRef(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    if (running.current) return;
    running.current = true;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await expireDueOrders();
        setMessage(
          result.ok
            ? { ok: true, text: `ยกเลิกออเดอร์ที่หมดอายุแล้ว ${number.format(result.count)} ออเดอร์ (คืนสต็อกและแต้มแล้ว)` }
            : { ok: false, text: result.error },
        );
      } finally {
        running.current = false;
      }
    });
  }

  return (
    <div className="mb-4">
      <Button type="button" variant="card" onClick={run} disabled={pending}>
        {pending ? "กำลังตรวจ..." : "ยกเลิกออเดอร์ที่หมดอายุ"}
      </Button>
      <p className="mt-1 text-xs text-muted">ระบบทำให้อัตโนมัติทุกชั่วโมง กดเองได้เมื่อต้องการให้คืนแต้มทันที</p>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`mt-2 text-sm ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
