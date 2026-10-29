"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "./sign-out-button";

export type AccountMenuLink = { href: string; label: string };

/**
 * DESIGN-3 3.3: the avatar button and its panel, a plain disclosure (no role="menu": the links are reached
 * with Tab in order). Escape closes it and returns focus to the button; a pointerdown outside, a link tap
 * or a pathname change closes it without moving focus. Rendered inside the header's Suspense boundary, so
 * usePathname() never suspends a static shell. The panel id comes from useId: <Activity> keeps visited
 * pages mounted, and each copy of the header needs its own id.
 */
export function AccountMenu({
  name,
  email,
  avatarUrl,
  links,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  links: AccountMenuLink[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on navigation: adjust state while rendering (React docs, "storing information from previous renders").
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  const closeToButton = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeToButton();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, closeToButton]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="เมนูบัญชี"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-full hover:bg-accent-soft focus-visible:bg-accent-soft"
      >
        <Avatar name={name} url={avatarUrl} size={36} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        onClick={(e) => {
          // Links navigate client-side and the header stays mounted: close on any link tap.
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="absolute top-full right-0 z-50 mt-1 w-[260px] max-w-[calc(100vw-2rem)] rounded-card border border-rule bg-surface p-3 shadow-cast"
      >
        <div className="flex items-center gap-3">
          <Avatar name={name} url={avatarUrl} size={48} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{name}</p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
        </div>
        <div className="my-3 border-t border-dashed border-rule" />
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-11 items-center rounded-input px-2 text-ink hover:bg-accent-soft hover:text-accent">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-2 px-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
