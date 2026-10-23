"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/browser";
import { uniqueId } from "@/lib/unique-id";

/** Badge text: the unread count, capped at "9+". */
export function badgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export function bellLabel(count: number): string {
  return count > 0 ? `แจ้งเตือน ยังไม่อ่าน ${count} รายการ` : "แจ้งเตือน ไม่มีรายการใหม่";
}

export type UnreadState = { signedIn: boolean; count: number; subscribed: boolean };

// Unread count for the signed-in user (R44, R45), shared by every consumer on the page (header bell, the
// student bottom nav): one REST count and one Realtime channel, however many consumers are mounted.
//
// A module-level store (useSyncExternalStore), deliberately not a React context provider: a provider has to
// sit above the page content, and a context update while a streamed <Suspense> boundary below it is still
// dehydrated makes React throw that server HTML away and client-render the boundary (seen as transient
// duplicate DOM). The store starts with the first consumer and stops with the last.
// Client-only so the layouts stay static: the user and the initial count are read after mount. Live updates
// use Realtime postgres_changes, which applies the signed-in user's RLS; the filter only narrows, it is not
// the security boundary.

const INITIAL: UnreadState = { signedIn: false, count: 0, subscribed: false };
let state: UnreadState = INITIAL;
const listeners = new Set<() => void>();
let stopStore: (() => void) | null = null;

function setState(patch: Partial<UnreadState>) {
  const next = { ...state, ...patch };
  if (next.signedIn === state.signedIn && next.count === state.count && next.subscribed === state.subscribed) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) stopStore = startStore();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopStore) {
      stopStore();
      stopStore = null;
      // nobody is listening: forget the user, so a later sign-in never shows a previous user's count
      state = INITIAL;
    }
  };
}

const getSnapshot = () => state;

/** The store without React (unit tests). */
export const unreadStore = { subscribe, getSnapshot };
const getServerSnapshot = () => INITIAL;

/** The shared unread state (signed out / loading: signedIn false, count 0). */
export function useUnreadCount(): UnreadState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function startStore(): () => void {
  const supabase = createBrowserClient();
  let cancelled = false;
  let channel: RealtimeChannel | null = null;
  let activeUid: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function refetch() {
    // The answer belongs to the user it was asked for: drop it if the user changed meanwhile.
    const uid = activeUid;
    if (!uid) return;
    const { count: unread, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (!cancelled && uid === activeUid && !error && unread !== null) setState({ count: unread });
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
    setState({ subscribed: false });
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
    // A different user: never show the previous user's count, not even until the refetch answers.
    setState({ signedIn: true, count: 0 });
    // Count first, independent of Realtime: websockets can be blocked (school wifi).
    void refetch();
    // The realtime socket must carry this user's JWT, otherwise RLS hides every row.
    await supabase.realtime.setAuth(accessToken);
    if (cancelled || activeUid !== uid) return;
    const filter = `user_id=eq.${uid}`;
    const mine: RealtimeChannel = supabase
      // Unique per start: realtime-js returns an existing channel with the same topic, and a
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
        // A channel that was torn down (last consumer gone, sign-out, user change) must not touch state.
        if (cancelled || channel !== mine) return;
        if (status === "SUBSCRIBED") {
          setState({ subscribed: true });
          void refetch();
        } else {
          setState({ subscribed: false });
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") void refetch();
        }
      });
    channel = mine;
  }

  function stop() {
    teardown();
    setState({ signedIn: false, count: 0 });
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
}

export function BellIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function UnreadBadge({ count, className = "absolute right-0.5 top-0.5" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span aria-hidden="true" className={`${className} min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold leading-5 text-white`}>
      {badgeText(count)}
    </span>
  );
}

/** Bell with the unread count (shared store, see above). Renders nothing until a session is known. */
export function NotificationBell({ href = "/notifications" }: { href?: string }) {
  const { signedIn, count, subscribed } = useUnreadCount();
  if (!signedIn) return null;
  return (
    <Link
      href={href}
      aria-label={bellLabel(count)}
      data-realtime={subscribed ? "subscribed" : "connecting"}
      className="relative inline-flex size-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
    >
      <BellIcon />
      <UnreadBadge count={count} />
    </Link>
  );
}
