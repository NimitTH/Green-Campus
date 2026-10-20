"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/browser";

function uniqueId(): string {
  // randomUUID needs a secure context (localhost counts); fall back for plain http.
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Badge text: the unread count, capped at "9+". */
export function badgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export function bellLabel(count: number): string {
  return count > 0 ? `แจ้งเตือน ยังไม่อ่าน ${count} รายการ` : "แจ้งเตือน ไม่มีรายการใหม่";
}

/**
 * Bell with the unread count (R44, R45). Client-only so the layouts stay static: the user and the
 * initial count are read after mount. Live updates use Realtime postgres_changes, which applies the
 * signed-in user's RLS; the filter only narrows, it is not the security boundary.
 */
export function NotificationBell() {
  const [signedIn, setSignedIn] = useState(false);
  const [count, setCount] = useState(0);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let activeUid: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refetch() {
      const { count: unread, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (!cancelled && !error && unread !== null) setCount(unread);
    }

    // The count always comes from the DB; bursts of events collapse into one refetch.
    function scheduleRefetch() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refetch();
      }, 300);
    }

    function teardown() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      setSubscribed(false);
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
      activeUid = null;
    }

    async function start(uid: string, accessToken: string) {
      try {
        await startChannel(uid, accessToken);
      } catch (e) {
        console.error("notification bell: realtime setup failed", e);
      }
    }

    async function startChannel(uid: string, accessToken: string) {
      if (activeUid === uid) return;
      teardown();
      activeUid = uid;
      setSignedIn(true);
      // The realtime socket must carry this user's JWT, otherwise RLS hides every row.
      await supabase.realtime.setAuth(accessToken);
      if (cancelled || activeUid !== uid) return;
      const filter = `user_id=eq.${uid}`;
      channel = supabase
        // Unique per mount: realtime-js returns an existing channel with the same topic, and a
        // channel being removed stays in that list until the server acks the leave.
        .channel(`notifications:${uid}:${uniqueId()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter }, () => {
          scheduleRefetch();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter }, () => {
          scheduleRefetch();
        })
        // Fires on first subscribe and on every reconnect: events may have been missed meanwhile.
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setSubscribed(true);
            void refetch();
          } else {
            setSubscribed(false);
          }
        });
    }

    function stop() {
      teardown();
      setSignedIn(false);
      setCount(0);
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) void start(data.session.user.id, data.session.access_token);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (!session) {
        if (event === "SIGNED_OUT") stop();
        return;
      }
      void start(session.user.id, session.access_token);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible" && activeUid) void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sub.subscription.unsubscribe();
      teardown();
    };
  }, []);

  if (!signedIn) return null;

  return (
    <Link
      href="/notifications"
      aria-label={bellLabel(count)}
      data-realtime={subscribed ? "subscribed" : "connecting"}
      className="relative inline-flex size-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold leading-5 text-white"
        >
          {badgeText(count)}
        </span>
      ) : null}
    </Link>
  );
}
