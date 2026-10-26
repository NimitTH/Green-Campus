"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { ERROR_HINT_TH, ERROR_TITLE_TH, RETRY_LABEL_TH } from "./_components/error-view";

// Root layout failures (R143). global-error replaces the root layout, so it renders its own <html>/<body>
// and gets neither globals.css nor the font: inline styles only. No metadata export (Client Component); the
// React <title> element instead (docs: 03-file-conventions/error.md#global-error).
// Same palette as the theme tokens (oklch values copied), with the system dark scheme; no stored choice is read here.
const GLOBAL_ERROR_CSS = ":root{--bg:oklch(97% 0.008 95);--fg:oklch(22% 0.02 155);--muted:oklch(47% 0.02 150);--rule:oklch(62% 0.02 130);--accent:oklch(45% 0.12 150);--on-accent:oklch(99% 0.004 95);--danger:oklch(50% 0.18 27);color-scheme:light dark}@media (prefers-color-scheme:dark){:root{--bg:oklch(18% 0.02 160);--fg:oklch(94% 0.01 120);--muted:oklch(74% 0.02 140);--rule:oklch(52% 0.02 150);--accent:oklch(78% 0.14 150);--on-accent:oklch(18% 0.02 160);--danger:oklch(72% 0.15 27)}}";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "var(--bg)", color: "var(--fg)" }}>
        <style>{GLOBAL_ERROR_CSS}</style>
        <title>{`${ERROR_TITLE_TH} | Green Campus`}</title>
        <main role="alert" style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: "var(--danger)" }}>{ERROR_TITLE_TH}</h1>
          <p>{ERROR_HINT_TH}</p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ minHeight: 44, padding: "0 20px", borderRadius: 16, border: 0, background: "var(--accent)", color: "var(--on-accent)", fontWeight: 600 }}
            >
              {RETRY_LABEL_TH}
            </button>
            {/* A full page load on purpose: the root layout itself failed, so no client navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 20px", borderRadius: 16, border: "1px solid var(--rule)", color: "var(--fg)" }}
            >
              กลับหน้าแรก
            </a>
          </p>
          {error.digest ? <p style={{ fontSize: 12, color: "var(--muted)" }}>รหัสอ้างอิง: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
