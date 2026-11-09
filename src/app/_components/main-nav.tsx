"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

// DESIGN-3 3.1/3.2: the signed-in student's centre nav in the shared header (md+ only; phones use the
// bottom nav of the (student) layout, which carries the same "เมนูหลัก" label and is display:none from md).
// Cache Components: usePathname() suspends while the static shell of a route with unknown dynamic params is
// prerendered, so it is read inside <Suspense>; the fallback is the same nav without the highlight.

export type MainNavItem = { href: string; label: string; match: string[] };

export const MAIN_NAV_ITEMS: readonly MainNavItem[] = [
  { href: "/dashboard", label: "หน้าหลัก", match: ["/dashboard"] },
  { href: "/activities", label: "กิจกรรม", match: ["/activities"] },
  { href: "/my-submissions", label: "ผลที่ส่ง", match: ["/my-submissions"] },
  { href: "/rewards", label: "รางวัล", match: ["/rewards", "/cart", "/orders"] },
  { href: "/leaderboard", label: "อันดับ", match: ["/leaderboard"] },
  { href: "/articles", label: "บทความ", match: ["/articles"] },
];

export const STAFF_MAIN_NAV_ITEMS: readonly MainNavItem[] = [
  { href: "/staff", label: "หน้าหลัก", match: ["/staff"] },
  { href: "/activities", label: "กิจกรรม", match: ["/activities"] },
  { href: "/articles", label: "บทความ", match: ["/articles"] },
  { href: "/rewards", label: "รางวัล", match: ["/rewards", "/orders"] },
  { href: "/leaderboard", label: "อันดับ", match: ["/leaderboard"] },
];

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function active(pathname: string | null, item: MainNavItem): boolean {
  return pathname !== null && item.match.some((m) => isUnder(pathname, m));
}

function WithPathname({ items }: { items: readonly MainNavItem[] }) {
  return <MainNavView pathname={usePathname()} items={items} />;
}

export function MainNav({ items = MAIN_NAV_ITEMS }: { items?: readonly MainNavItem[] }) {
  return (
    <Suspense fallback={<MainNavView pathname={null} items={items} />}>
      <WithPathname items={items} />
    </Suspense>
  );
}

function MainNavView({ pathname, items }: { pathname: string | null; items: readonly MainNavItem[] }) {
  return (
    <nav aria-label="เมนูหลัก" className="mx-auto hidden min-w-0 items-center gap-0.5 text-sm whitespace-nowrap md:flex">
      {items.map((item) => {
        const current = active(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full px-2.5 lg:px-3 ${
              current ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-accent-soft hover:text-accent"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
