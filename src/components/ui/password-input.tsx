"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { inputClass } from "./field";

function Eye({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

/** A password field with a show/hide eye button inside its right edge. Name, autoComplete and data-testid pass through. */
export function PasswordInput({ className, id, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...rest} id={inputId} type={shown ? "text" : "password"} className={[inputClass, "pr-12", className].filter(Boolean).join(" ")} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-pressed={shown}
        aria-controls={inputId}
        aria-label={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="absolute inset-y-0 right-0 inline-flex h-11 w-11 items-center justify-center rounded-input text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Eye off={shown} />
      </button>
    </div>
  );
}
