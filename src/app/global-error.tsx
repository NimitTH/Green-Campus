"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { ERROR_HINT_TH, ERROR_TITLE_TH, RETRY_LABEL_TH } from "./_components/error-view";

// Root layout failures (R143). global-error replaces the root layout, so it renders its own <html>/<body>
// and gets neither globals.css nor the font: inline styles only. No metadata export (Client Component); the
// React <title> element instead (docs: 03-file-conventions/error.md#global-error).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#111" }}>
        <title>{`${ERROR_TITLE_TH} | Green Campus`}</title>
        <main role="alert" style={{ maxWidth: 520, margin: "40px auto", padding: "0 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: "#991b1b" }}>{ERROR_TITLE_TH}</h1>
          <p>{ERROR_HINT_TH}</p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ minHeight: 44, padding: "0 20px", borderRadius: 16, border: 0, background: "#15803d", color: "#fff", fontWeight: 600 }}
            >
              {RETRY_LABEL_TH}
            </button>
            {/* A full page load on purpose: the root layout itself failed, so no client navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 20px", borderRadius: 16, border: "1px solid #d1d5db", color: "#111" }}
            >
              กลับหน้าแรก
            </a>
          </p>
          {error.digest ? <p style={{ fontSize: 12, color: "#6b7280" }}>รหัสอ้างอิง: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
