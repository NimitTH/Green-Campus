"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { Button, EmptyState } from "@/components/ui";
import { formatBangkok } from "@/lib/datetime";
import { internalLink } from "@/lib/notifications/link";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};


export function NotificationList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <EmptyState>ยังไม่มีการแจ้งเตือน</EmptyState>
    );
  }

  const hasUnread = items.some((n) => n.read_at === null);

  function open(item: NotificationRow) {
    setError(null);
    startTransition(async () => {
      if (item.read_at === null) {
        const result = await markNotificationRead(item.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      const target = internalLink(item.link);
      if (target) router.push(target);
      else router.refresh();
    });
  }

  function readAll() {
    setError(null);
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="button" onClick={readAll} disabled={pending || !hasUnread}>
          อ่านทั้งหมด
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mb-3 rounded-input border border-danger bg-surface p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} data-testid="notification">
            <button
              type="button"
              onClick={() => open(n)}
              disabled={pending}
              className={`block min-h-11 w-full rounded-card border p-4 text-left text-ink shadow-card transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-55 ${
                n.read_at === null ? "border-accent bg-accent-soft" : "border-rule bg-surface"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold">{n.title}</span>
                {n.read_at === null ? (
                  <span className="shrink-0 rounded-full bg-accent px-2 text-xs leading-5 text-on-accent">ใหม่</span>
                ) : null}
              </span>
              {n.body ? <span className="mt-1 block text-sm text-ink">{n.body}</span> : null}
              <span className="mt-1 block text-xs text-muted">{formatBangkok(n.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
