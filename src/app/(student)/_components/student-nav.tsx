"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BellIcon, UnreadBadge, bellLabel, useUnreadCount } from "@/components/NotificationBell";

// Spec 9.2: student navigation. Mobile: fixed bottom nav with exactly 5 items. Desktop (md+): one header row.
// Both are labelled "เมนูหลัก"; only one is displayed at a time (the other is display:none, so it is out of
// the accessibility tree).
// Cache Components: usePathname() suspends while the static shell of a route with unknown dynamic params
// (/activities/[id], /orders/[id], ...) is prerendered, so each nav reads it inside <Suspense>; the fallback
// is the same nav without the active highlight.

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

type Item = { href: string; label: string; match: string[] };

const BOTTOM: Item[] = [
  { href: "/dashboard", label: "หน้าหลัก", match: ["/dashboard", "/leaderboard", "/my-submissions"] },
  { href: "/activities", label: "กิจกรรม", match: ["/activities"] },
  { href: "/rewards", label: "รางวัล", match: ["/rewards", "/cart", "/orders"] },
  { href: "/notifications", label: "แจ้งเตือน", match: ["/notifications"] },
  { href: "/profile", label: "ฉัน", match: ["/profile"] },
];

const TOP: Item[] = [
  { href: "/dashboard", label: "หน้าหลัก", match: ["/dashboard"] },
  { href: "/activities", label: "กิจกรรม", match: ["/activities"] },
  { href: "/my-submissions", label: "ผลที่ส่ง", match: ["/my-submissions"] },
  { href: "/rewards", label: "รางวัล", match: ["/rewards", "/cart", "/orders"] },
  { href: "/leaderboard", label: "อันดับ", match: ["/leaderboard"] },
  { href: "/articles", label: "บทความ", match: ["/articles"] },
  { href: "/profile", label: "ฉัน", match: ["/profile"] },
];

function active(pathname: string | null, item: Item): boolean {
  return pathname !== null && item.match.some((m) => isUnder(pathname, m));
}

function WithPathname({ render }: { render: (pathname: string | null) => React.ReactNode }) {
  return <>{render(usePathname())}</>;
}

function withPathname(render: (pathname: string | null) => React.ReactNode) {
  return (
    <Suspense fallback={render(null)}>
      <WithPathname render={render} />
    </Suspense>
  );
}

/** Desktop header row (hidden below md). Never wraps: short labels, nowrap, and secondary pages live on the hubs. */
export function StudentTopNav() {
  return withPathname((pathname) => <TopNavView pathname={pathname} />);
}

function TopNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="เมนูหลัก" className="hidden min-w-0 items-center gap-1 text-sm whitespace-nowrap md:flex">
      {TOP.map((item) => {
        const current = active(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-lg px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 ${current ? "font-semibold text-green-700" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  "/activities": (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  "/rewards": (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  "/profile": (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

/** Mobile bottom nav (spec 9.2: หน้าหลัก / กิจกรรม / รางวัล / แจ้งเตือน / ฉัน), hidden from md up. */
export function BottomNav() {
  return withPathname((pathname) => <BottomNavView pathname={pathname} />);
}

function BottomNavView({ pathname }: { pathname: string | null }) {
  const unread = useUnreadCount();
  const count = unread.signedIn ? unread.count : 0;
  return (
    <nav
      aria-label="เมนูหลัก"
      data-bottom-nav=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:hidden dark:border-gray-800 dark:bg-gray-950"
    >
      <ul className="grid grid-cols-5">
        {BOTTOM.map((item) => {
          const current = active(pathname, item);
          const isBell = item.href === "/notifications";
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                // The notifications item is the bell on phones: same label and realtime state as the header bell.
                aria-label={isBell ? bellLabel(count) : undefined}
                data-realtime={isBell ? (unread.subscribed ? "subscribed" : "connecting") : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs ${
                  current ? "font-semibold text-green-700" : "text-gray-600 dark:text-gray-400"
                }`}
              >
                <span className="relative">
                  {isBell ? (
                    <BellIcon className="size-6" />
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {ICONS[item.href]}
                    </svg>
                  )}
                  {isBell ? <UnreadBadge count={count} className="absolute -right-3 -top-1" /> : null}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
