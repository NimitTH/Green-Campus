"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "./button";
import { inputClass } from "./field";

// DESIGN-3 5.2: copies the page URL. "คัดลอกแล้ว" for 2 seconds (announced through role="status"); when the
// clipboard is unavailable or refused, a read-only field with the URL appears, already selected.
export function CopyLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [url, setUrl] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (state === "failed") field.current?.select();
  }, [state]);

  async function copy() {
    const href = window.location.href;
    setUrl(href);
    try {
      await navigator.clipboard.writeText(href);
      setState("copied");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className={buttonClass({ variant: "card", size: "sm" })}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
        คัดลอกลิงก์
      </button>
      <span role="status" className="text-sm text-accent">
        {state === "copied" ? "คัดลอกแล้ว" : ""}
      </span>
      {state === "failed" ? (
        <input
          ref={field}
          type="text"
          readOnly
          value={url}
          aria-label="คัดลอกลิงก์"
          onFocus={(e) => e.currentTarget.select()}
          className={`${inputClass} w-full sm:w-72`}
        />
      ) : null}
    </div>
  );
}
