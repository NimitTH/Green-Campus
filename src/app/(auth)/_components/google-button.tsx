"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { GOOGLE_CALLBACK_PATH, OAUTH_NEXT_COOKIE, OAUTH_NEXT_MAX_AGE, isGoogleAuthEnabled } from "@/lib/auth/google";
import { GOOGLE_FAILED_MESSAGE } from "@/lib/auth/messages";
import { safeNextPath } from "@/lib/auth/routes";
import { createBrowserClient } from "@/lib/supabase/browser";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

// NEXT_PUBLIC_ values are inlined at build time (docs/google-signin.md: redeploy after changing it).
const ENABLED = isGoogleAuthEnabled(process.env.NEXT_PUBLIC_GOOGLE_AUTH);

/**
 * Sign in or up with Google through Supabase (docs/superpowers/specs/2026-11-26-google-signin-design.md). With
 * NEXT_PUBLIC_GOOGLE_AUTH unset it stays the placeholder: pressing it only says the feature is not open yet.
 */
export function GoogleButton({ label }: { label: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    if (!ENABLED) {
      setMessage("ยังไม่เปิดให้ใช้งาน");
      return;
    }
    setPending(true);
    setMessage(null);
    // ?next= rides in a short cookie so the redirect URL matches the Supabase allow-list exactly
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Max-Age=${OAUTH_NEXT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    const { error } = await createBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${GOOGLE_CALLBACK_PATH}` },
    });
    if (error) {
      setPending(false);
      setMessage(GOOGLE_FAILED_MESSAGE);
    }
    // on success the browser is already leaving for Google; the button stays disabled
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className={buttonClass({ variant: "card", size: "lg", className: "w-full" })}
      >
        <GoogleLogo />
        {label}
      </button>
      <div role="status" className="mt-2 text-center text-sm text-muted">
        {message}
      </div>
    </div>
  );
}
