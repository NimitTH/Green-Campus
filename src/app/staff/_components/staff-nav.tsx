"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";

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
              className={`flex min-h-11 items-center rounded-input border-l-[3px] px-3 ${
                current ? "border-accent bg-accent-soft font-semibold text-ink" : "border-transparent text-ink hover:bg-accent-soft"
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
      className={`${station ? "hidden xl:flex" : "hidden md:flex"} w-52 shrink-0 flex-col xl:w-60 border-r border-rule bg-paper-2 px-3 py-4`}
    >
      {children}
    </aside>
  );
}

/**
 * Mobile drawer: a disclosure button (aria-expanded / aria-controls) and a panel under the header.
 * Opening moves focus to the first link. Escape (anywhere, while open) and the toggle close it and return
 * focus to the toggle. A link tap or any pathname change (the layout stays mounted across client
 * navigations) closes it without moving focus, so the new page keeps Next's own focus handling.
 */
export function StaffDrawer({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DrawerFrame pathname={null}>{children}</DrawerFrame>}>
      <DrawerWithPath>{children}</DrawerWithPath>
    </Suspense>
  );
}

function DrawerWithPath({ children }: { children: React.ReactNode }) {
  return <DrawerFrame pathname={usePathname()}>{children}</DrawerFrame>;
}

function DrawerFrame({ pathname, children }: { pathname: string | null; children: React.ReactNode }) {
  const station = isStation(pathname);
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation: adjust state while rendering (React docs, "storing information from previous renders").
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  const closeToToggle = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // the first link; the panel itself while the (streamed) menu has not arrived yet
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("a[href], button") ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeToToggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeToToggle]);

  return (
    <div className={station ? "xl:hidden" : "md:hidden"}>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? closeToToggle() : setOpen(true))}
        className="inline-flex size-11 items-center justify-center rounded-input text-ink hover:bg-accent-soft"
      >
        <span className="sr-only">เมนู</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      <div
        ref={panelRef}
        id={panelId}
        tabIndex={-1}
        hidden={!open}
        onClick={(e) => {
          // Links navigate client-side and the layout stays mounted: close the drawer on any link tap.
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="absolute inset-x-0 top-full z-40 outline-none max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-rule bg-paper-2 px-3 py-3 shadow-cast"
      >
        {children}
      </div>
    </div>
  );
}
