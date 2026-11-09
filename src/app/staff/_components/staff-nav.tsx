"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Suspense, use, useCallback, useEffect, useId, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ui";
import { SIDEBAR_COLLAPSED, SIDEBAR_HTML_ATTR, sidebarCookieAssignment } from "./sidebar-cookie";
import { StaffNavIcon, type StaffIconName } from "./staff-nav-icons";

// Spec 9.3: staff navigation. Sidebar from md up, a drawer (menu button) below. The weigh station is a
// standing kiosk page with big buttons, so there the sidebar only appears from xl and tablets get the drawer.
// Cache Components: usePathname() suspends while the static shell of a route with unknown dynamic params is
// prerendered, so every reader sits inside <Suspense> (fallback: the same markup, non-station, no highlight).
// DESIGN-4 4.2: the sidebar collapses to icons (w-16). The look is CSS (the sidebar-collapsed variant, globals.css), so the
// server-rendered menu parts and the static shell follow it too; client links read context only for aria-label/tooltip.

export type StaffNavItem = { href: string; label: string; icon: StaffIconName };

/** True inside a collapsed sidebar (the drawer has no provider, so it always shows labels). */
const CollapsedContext = createContext(false);

/** Tooltip for a collapsed item: shown on hover / keyboard focus of the parent `group/item`, never covers other links. */
const TOOLTIP =
  "pointer-events-none absolute top-1/2 left-full z-50 ml-2 hidden -translate-y-1/2 rounded-input bg-ink px-2 py-1 text-xs whitespace-nowrap text-paper shadow-cast group-hover/item:block group-focus-visible/item:block";

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
  const collapsed = use(CollapsedContext);
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const current = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={`group/item relative flex min-h-11 items-center gap-3 rounded-input border-l-[3px] px-3 sidebar-collapsed:justify-center sidebar-collapsed:px-0 ${
                current ? "border-accent bg-accent-soft font-semibold text-ink" : "border-transparent text-ink hover:bg-accent-soft"
              }`}
            >
              <StaffNavIcon name={item.icon} className={current ? "text-accent" : "text-muted"} />
              <span className="min-w-0 sidebar-collapsed:sr-only">{item.label}</span>
              {collapsed ? (
                <span aria-hidden="true" className={TOOLTIP}>
                  {item.label}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Desktop sidebar (hidden on phones; hidden below xl on the weigh station). `collapsed` is the first state, read
 * from the cookie by the layout; the toggle switches at once on the client and rewrites the cookie (no refresh).
 * `shell`: the layout's Suspense fallback (static shell). It cannot know the cookie, so it collapses in CSS from
 * `<html data-staff-sidebar>` (SIDEBAR_INIT_SCRIPT, before first paint); see the sidebar-collapsed variant in globals.css.
 */
export function StaffSidebar({
  collapsed = false,
  shell = false,
  children,
}: {
  collapsed?: boolean;
  shell?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <SidebarFrame station={false} initialCollapsed={collapsed} shell={shell}>
          {children}
        </SidebarFrame>
      }
    >
      <SidebarWithPath initialCollapsed={collapsed} shell={shell}>
        {children}
      </SidebarWithPath>
    </Suspense>
  );
}

function SidebarWithPath({ initialCollapsed, shell, children }: { initialCollapsed: boolean; shell: boolean; children: React.ReactNode }) {
  return (
    <SidebarFrame station={isStation(usePathname())} initialCollapsed={initialCollapsed} shell={shell}>
      {children}
    </SidebarFrame>
  );
}

function SidebarFrame({
  station,
  initialCollapsed,
  shell,
  children,
}: {
  station: boolean;
  initialCollapsed: boolean;
  shell: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const id = useId();
  const label = collapsed ? "กางเมนู" : "ยุบเมนู";

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookieAssignment(next);
    // keep the pre-paint attribute in step with the cookie (it styles only the shell copy)
    if (next) document.documentElement.setAttribute(SIDEBAR_HTML_ATTR, SIDEBAR_COLLAPSED);
    else document.documentElement.removeAttribute(SIDEBAR_HTML_ATTR);
  }

  // Collapsed look comes from the sidebar-collapsed variant (data-collapsed here, or the html attribute for the shell),
  // so the server shell and the streamed sidebar share one set of classes. xl:w-60 needs its own collapsed override.
  return (
    <aside
      id={id}
      data-collapsed={collapsed ? "true" : "false"}
      data-sidebar-shell={shell ? "" : undefined}
      className={`${station ? "hidden xl:flex" : "hidden md:flex"} w-52 shrink-0 flex-col border-r border-rule bg-paper-2 px-3 py-4 xl:w-60 sidebar-collapsed:w-16 sidebar-collapsed:px-2 sidebar-collapsed:xl:w-16`}
    >
      <CollapsedContext value={collapsed}>{children}</CollapsedContext>
      <div className="mt-auto flex flex-col items-start gap-1 pt-3 sidebar-collapsed:items-center">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={id}
          onClick={toggle}
          className="group/item relative flex min-h-11 w-full items-center gap-3 rounded-input px-3 text-sm text-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sidebar-collapsed:w-11 sidebar-collapsed:justify-center sidebar-collapsed:px-0"
        >
          <StaffNavIcon name="collapse" className="text-muted sidebar-collapsed:hidden" />
          <StaffNavIcon name="expand" className="hidden text-muted sidebar-collapsed:block" />
          <span className="sidebar-collapsed:sr-only">{label}</span>
          {collapsed ? (
            <span aria-hidden="true" className={TOOLTIP}>
              {label}
            </span>
          ) : null}
        </button>
        <ThemeToggle />
      </div>
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
