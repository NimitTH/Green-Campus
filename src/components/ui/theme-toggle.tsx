"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyThemeChoice, readThemeChoice, type ThemeChoice } from "./theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "สว่าง" },
  { value: "dark", label: "มืด" },
  { value: "system", label: "ตามระบบ" },
];

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("themechange", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

function getSnapshot(): ThemeChoice {
  return readThemeChoice(safeLocalStorage());
}

// The server cannot know the stored choice, so the server snapshot is "system"; React reconciles the real value
// after hydration without a hydration error (the <html> attribute itself is set earlier by THEME_INIT_SCRIPT).
function useThemeChoice(): ThemeChoice {
  const choice = useSyncExternalStore(subscribe, getSnapshot, () => "system" as ThemeChoice);
  // Re-apply <html data-theme> (no storage write) for React's dev Strict Mode remount, which clears attributes it
  // does not manage. Apply the value read from storage now, NOT `choice`: during hydration `choice` is still the
  // server snapshot "system", and applying it would remove the attribute the head script set (a flash). `choice`
  // stays a dependency so a cross-tab `storage` change re-runs this.
  useLayoutEffect(() => {
    const stored = readThemeChoice(safeLocalStorage());
    const root = document.documentElement;
    if (stored === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", stored);
  }, [choice]);
  return choice;
}

function select(choice: ThemeChoice): void {
  applyThemeChoice(choice, document.documentElement, safeLocalStorage());
}

function Options({ choice, onPick }: { choice: ThemeChoice; onPick?: () => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="ธีม"
      className="inline-flex gap-1 rounded-input bg-paper-2 p-1"
    >
      {OPTIONS.map((o) => {
        const checked = choice === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => {
              select(o.value);
              onPick?.();
            }}
            className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-input px-3 text-sm transition-colors duration-(--dur-short) ease-(--ease-out) ${
              checked ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const choice = useThemeChoice();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
    }
    function onPointer(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  if (!compact) {
    return (
      <div className={className}>
        <Options choice={choice} />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="ธีม"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-input text-muted transition-colors duration-(--dur-short) ease-(--ease-out) hover:bg-paper-2 hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 rounded-card border border-rule bg-surface p-2 shadow-card"
      >
        {open ? <Options choice={choice} onPick={() => close(true)} /> : null}
      </div>
    </div>
  );
}
