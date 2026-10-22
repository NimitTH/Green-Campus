"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
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
      <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
        ยังไม่มีการแจ้งเตือน
      </p>
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
        <button
          type="button"
          onClick={readAll}
          disabled={pending || !hasUnread}
          className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          อ่านทั้งหมด
        </button>
      </div>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg border border-red-300 p-3 text-sm text-red-700">
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
              className={`block min-h-11 w-full rounded-2xl border p-4 text-left hover:border-green-600 ${
                n.read_at === null
                  ? "border-green-600 bg-green-50 dark:bg-green-950"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold">{n.title}</span>
                {n.read_at === null ? (
                  <span className="shrink-0 rounded-full bg-green-700 px-2 text-xs leading-5 text-white">ใหม่</span>
                ) : null}
              </span>
              {n.body ? <span className="mt-1 block text-sm text-gray-700 dark:text-gray-300">{n.body}</span> : null}
              <span className="mt-1 block text-xs text-gray-500">{formatBangkok(n.created_at)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
