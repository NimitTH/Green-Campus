"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { applyThemeChoice, nextThemeChoice, readThemeChoice } from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  window.addEventListener("storage", onChange);
  window.addEventListener("themechange", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("themechange", onChange);
    media.removeEventListener("change", onChange);
  };
}

// Dark is on screen when <html data-theme="dark">, or when no attribute is set and the system prefers dark.
function getSnapshot(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

// The server cannot know the stored choice or the system scheme, so the server snapshot is false. Only aria-pressed
// depends on it; the icons swap by CSS, so hydration cannot mismatch visually.
function useShowingDark(): boolean {
  const showingDark = useSyncExternalStore(subscribe, getSnapshot, () => false);
  // Re-apply <html data-theme> (no storage write) for React's dev Strict Mode remount, which clears attributes it
  // does not manage. Apply the value read from storage now, NOT state: during hydration state is still the server
  // snapshot, and applying it would remove the attribute the head script set (a flash).
  useLayoutEffect(() => {
    const stored = readThemeChoice(safeLocalStorage());
    const root = document.documentElement;
    if (stored === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", stored);
  }, [showingDark]);
  return showingDark;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const showingDark = useShowingDark();
  return (
    <button
      type="button"
      aria-label="ธีม"
      aria-pressed={showingDark}
      onClick={() => {
        applyThemeChoice(nextThemeChoice(getSnapshot()), document.documentElement, safeLocalStorage());
      }}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-input border border-rule bg-surface text-ink shadow-[1px_1px_0_var(--rule),2px_2px_0_var(--rule)] transition-colors duration-(--dur-short) ease-(--ease-out) hover:bg-paper-2 ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 dark:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="hidden size-5 dark:block" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
