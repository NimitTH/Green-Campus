"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useId, useState } from "react";

// Spec 9.3: staff navigation. Sidebar from md up, a drawer (menu button) below. The weigh station is a
// standing kiosk page with big buttons, so there the sidebar only appears from xl and tablets get the drawer.
// Cache Components: usePathname() suspends while the static shell of a route with unknown dynamic params is
// prerendered, so every reader sits inside <Suspense> (fallback: the same markup, non-station, no highlight).

export type StaffNavItem = { href: string; label: string };

function isStation(pathname: string | null): boolean {
  return pathname === "/staff/weigh-station" || (pathname ?? "").startsWith("/staff/weigh-station/");
}

function isActive(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  if (href === "/staff") return pathname === "/staff";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The links (the list itself is built on the server, so admin items never reach a teacher). */
export function StaffNavLinks({ items }: { items: StaffNavItem[] }) {
  return (
    <Suspense fallback={<LinksView items={items} pathname={null} />}>
      <LinksWithPath items={items} />
    </Suspense>
  );
}

function LinksWithPath({ items }: { items: StaffNavItem[] }) {
  return <LinksView items={items} pathname={usePathname()} />;
}

function LinksView({ items, pathname }: { items: StaffNavItem[]; pathname: string | null }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const current = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 ${
                current ? "bg-green-50 font-semibold text-green-800 dark:bg-green-950 dark:text-green-300" : "hover:bg-gray-100 dark:hover:bg-gray-900"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Desktop sidebar wrapper (hidden on phones; hidden below xl on the weigh station). */
export function StaffSidebar({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<SidebarFrame station={false}>{children}</SidebarFrame>}>
      <SidebarWithPath>{children}</SidebarWithPath>
    </Suspense>
  );
}

function SidebarWithPath({ children }: { children: React.ReactNode }) {
  return <SidebarFrame station={isStation(usePathname())}>{children}</SidebarFrame>;
}

function SidebarFrame({ station, children }: { station: boolean; children: React.ReactNode }) {
  return (
    <aside
      className={`${station ? "hidden xl:block" : "hidden md:block"} w-52 shrink-0 border-r border-gray-200 px-3 py-4 dark:border-gray-800`}
    >
      {children}
    </aside>
  );
}

/**
 * Mobile drawer: a disclosure button (aria-expanded / aria-controls) and a panel under the header. A tap on
 * a link inside closes it; Escape closes it too.
 */
export function StaffDrawer({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DrawerFrame station={false}>{children}</DrawerFrame>}>
      <DrawerWithPath>{children}</DrawerWithPath>
    </Suspense>
  );
}

function DrawerWithPath({ children }: { children: React.ReactNode }) {
  return <DrawerFrame station={isStation(usePathname())}>{children}</DrawerFrame>;
}

function DrawerFrame({ station, children }: { station: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className={station ? "xl:hidden" : "md:hidden"}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"
      >
        <span className="sr-only">เมนู</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onClick={(e) => {
          // Links navigate client-side and the layout stays mounted: close the drawer on any link tap.
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-gray-200 bg-white px-3 py-3 shadow-lg dark:border-gray-800 dark:bg-gray-950"
      >
        {children}
      </div>
    </div>
  );
}
