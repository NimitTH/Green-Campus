# Sign in with Google: design (short)

Date: 2026-11-26 · Status: approved by the owner ("ผ่าน")

## Why

The owner wants sign-up and sign-in with Google. They also want to learn how it is set up (Google Cloud, Supabase,
Vercel). Anyone with a Google account may use it (owner, 2026-11-26), so there is no domain limit.

## Goals

- **The login and register buttons** sign in with Google through Supabase `signInWithOAuth`. They already exist as
  placeholders.
- **A first-time Google user** becomes a student automatically, with the name from Google. The existing
  `handle_new_user` trigger already reads `full_name`, so the database does not change.
- **The same e-mail as an existing account** is linked to it by Supabase, so points and history stay.
- **`?next=` is kept**, as with password sign-in. Default `/dashboard`.
- **Suspended accounts:** a suspended student is signed out at once and sees the suspended message, the same rule as
  password sign-in (DESIGN-4 6.4).
- **Cancel or provider error:** the user goes back to `/login?error=google`, which shows
  `เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง`.
- **`NEXT_PUBLIC_GOOGLE_AUTH=on`** turns the button on. Otherwise it keeps today's placeholder
  (`ยังไม่เปิดให้ใช้งาน`), so a machine or deploy without Google keys never lands on a Supabase error page.
- **`docs/google-signin.md`** is a step-by-step guide in Thai:
  - Google Cloud Console OAuth client and consent screen
  - Supabase Dashboard provider and redirect URLs
  - Vercel env
  - local `supabase/config.toml` with `env()` secrets
  - how to test

## Non-goals

- Limiting Google sign-in to a school domain.
- Other providers.
- Changing the profile or role rules.
- A password for Google-only users. They can set one later through "ลืมรหัสผ่าน" if they want.

## Approach

**Chosen:** Supabase `signInWithOAuth` (PKCE), already in the stack.

**Rejected:**
- Hand-written OAuth with Google: it duplicates Supabase Auth.
- Another auth library: a new dependency for the same job.

## Design

**Button:**
- Client component.
- Saves the safe `next` path in a short-lived cookie (`gc_oauth_next`, 10 min, SameSite=Lax, path `/`). The redirect
  URL stays query-free and matches the Supabase allow-list exactly.
- Calls `signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback/google } })`.

**`/auth/callback/google` (route handler):**
- With `?code`: exchange it for a session.
- Then check suspension the same way `signIn` does (`account_status`). If suspended, sign out and send to
  `/login?error=suspended`.
- Otherwise go to `safeNextPath(cookie)` and clear the cookie.
- No code, `?error=…`, or a failed exchange: `/login?error=google`.

**`loginErrorMessage`** gains `google`.

**Tests:**
- vitest for the redirect decision and the error message.
- e2e with the flag on:
  - The button navigates to `…/auth/v1/authorize?provider=google` (intercepted; no real Google).
  - `/auth/callback/google?error=access_denied` shows the message.
  - With the flag off, the placeholder still shows.
- The owner tests real Google sign-in on the deployed site.

## Left to the builder

- File layout.
- The exact guide wording.
- How the e2e turns the flag on (dev server env from `playwright.config.ts`).
