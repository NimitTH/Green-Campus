"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteNotification, deleteReadNotifications } from "@/app/actions/notifications";
import { Button } from "@/components/ui";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications/events";

// Lives in lib/notifications/events.ts so the bell does not import server actions; re-exported here.
export { NOTIFICATIONS_CHANGED_EVENT };

function changed() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function DeleteNotificationButton({ id, title, onError }: { id: string; title: string; onError: (message: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="quiet"
      size="sm"
      disabled={pending}
      aria-label={`ลบการแจ้งเตือน ${title}`}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteNotification(id);
          if (!result.ok) {
            onError(result.error ?? "");
            return;
          }
          router.refresh();
          changed();
        })
      }
    >
      ลบ
    </Button>
  );
}

export function DeleteReadButton({ onError }: { onError: (message: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("ลบการแจ้งเตือนที่อ่านแล้วทั้งหมด?")) return;
        startTransition(async () => {
          const result = await deleteReadNotifications();
          if (!result.ok) {
            onError(result.error ?? "");
            return;
          }
          router.refresh();
          changed();
        });
      }}
    >
      ลบที่อ่านแล้วทั้งหมด
    </Button>
  );
}
