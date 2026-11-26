# Sign in with Google: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The existing Google buttons on /login and /register sign in or up with Google through Supabase, behind
`NEXT_PUBLIC_GOOGLE_AUTH=on`, and a Thai guide teaches the owner the setup.

**Architecture:**
- The client button calls `supabase.auth.signInWithOAuth` (PKCE), with the `next` path kept in a short-lived cookie.
- The new route `/auth/callback/google` exchanges the code, applies the suspension rule, and redirects.
- No database change: `handle_new_user` already makes a student from `full_name`.

**Tech Stack:** Next.js 16.4.6 App Router, `@supabase/ssr`, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-google-signin-design.md`

## Global Constraints

- Read `AGENTS.md` and the relevant `node_modules/next/dist/docs/` guide (route handlers, cookies) before writing Next code.
- No new dependencies. No migration.
- The flag is `NEXT_PUBLIC_GOOGLE_AUTH === "on"`. Any other value keeps the placeholder (`ยังไม่เปิดให้ใช้งาน`).
- The cookie is `gc_oauth_next`: max-age 600 s, SameSite=Lax, path `/`. Its value is always checked with `safeNextPath`.
- `redirectTo` is `${window.location.origin}/auth/callback/google`, with no query.
- The failure redirect is `/login?error=google`, message `เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง`. The suspended
  redirect is `/login?error=suspended`, reusing the existing message.
- New UI strings go in `tests/redesign/ui-strings-6.allow.txt`.
- Stage explicit paths only. Never stage the owner's files (`AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`,
  `docs/REDESIGN-4-REQUEST.md`, `docs/old-site-inventory.md`, `src/app/_components/home/hero.tsx`, `.agents/`,
  `.claude/`, `skills-lock.json`).
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A `gc_oauth_next` cookie of `//evil.com` or `https://evil.com`:** the user goes to `/dashboard`, never off-site.
   Task 1 vitest covers this.
2. **The callback reached with `?error=access_denied` and no code (the user pressed Cancel):** `/login?error=google`
   with the Google message, not the e-mail-link message. Task 2 e2e covers this.
3. **A suspended student signing in with Google:** they are signed out and see the suspended message, with no session
   left. Task 1 vitest covers the decision; real Google is manual.
4. **The flag off (local machine without keys):** both buttons stay placeholders, and the URL does not change on
   click. Task 2 e2e covers this.
5. **The cookie missing or expired:** `/dashboard`. Task 1 vitest covers this.

---

### Task 1: Pure decisions (next cookie, callback target, error message)

**Files:**
- Create: `src/lib/auth/google.ts`, `src/lib/auth/google.test.ts`
- Modify: `src/lib/auth/messages.ts` (`loginErrorMessage`, a new `GOOGLE_FAILED_MESSAGE`), `src/lib/auth/messages.test.ts`

**Interfaces:**
- Produces, in `google.ts` (no `server-only`, so client and server can both import it):
  - `OAUTH_NEXT_COOKIE = "gc_oauth_next"`
  - `OAUTH_NEXT_MAX_AGE = 600`
  - `GOOGLE_CALLBACK_PATH = "/auth/callback/google"`
  - `isGoogleAuthEnabled(flag: string | undefined): boolean`, true only for `"on"`
  - `googleCallbackTarget(input: { exchanged: boolean; suspended: boolean; next: string | undefined }): string`.
    The rules are:
    - not exchanged → `/login?error=google`
    - suspended → `/login?error=suspended`
    - otherwise → `safeNextPath(next)`
- Produces, in `messages.ts`: `GOOGLE_FAILED_MESSAGE = "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง"`, and
  `loginErrorMessage("google")` returns it.

- [ ] **Step 1: Write the failing tests:**
  - `googleCallbackTarget` covers all three branches.
  - `next` of `"/rewards?q=1"` gives `"/rewards?q=1"`.
  - `"//evil.com"`, `"https://evil.com"` and `undefined` give `"/dashboard"`.
  - `isGoogleAuthEnabled("on")` is true; `"1"`, `""` and `undefined` are false.
  - `loginErrorMessage("google")` returns `GOOGLE_FAILED_MESSAGE`.
- [ ] **Step 2: Run** `npx vitest run src/lib/auth`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: Google sign-in decisions`.

### Task 2: Button, callback route, e2e

**Files:**
- Modify: `src/app/(auth)/_components/google-button.tsx`
- Create: `src/app/auth/callback/google/route.ts`
- Modify: `playwright.config.ts` (dev `webServer.env` gains `NEXT_PUBLIC_GOOGLE_AUTH: "on"` outside CI)
- Test: `tests/e2e/google-signin.spec.ts`

**Interfaces:**
- Consumes everything from Task 1.
- `GoogleButton({ label }: { label: string })` keeps its props.
  - When `isGoogleAuthEnabled(process.env.NEXT_PUBLIC_GOOGLE_AUTH)`, clicking does three things:
    - sets the cookie to the current `?next=` (read with `useSearchParams` inside the existing Suspense, or from
      `window.location.search` on click);
    - calls `createBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`;
    - disables itself while pending.
  - If the call returns an error, it shows `GOOGLE_FAILED_MESSAGE` in the existing `role="status"` area.
  - When the flag is off, it behaves exactly as today.
- `GET /auth/callback/google`:
  - Exchanges `code` with `createServerClient()`.
  - On success, reads `account_status.suspended_until` for the user; if `isSuspendedAt`, it calls `auth.signOut()`.
  - Redirects to `googleCallbackTarget(...)`, deleting the cookie in the response.

- [ ] **Step 1: Write the failing e2e tests:**
  - `"Google button goes to the Supabase Google authorize URL"`:
    - `page.route("**/auth/v1/authorize**", …)` captures the URL and fulfils it with a 200 stub.
    - Clicking `เข้าสู่ระบบด้วย Google` on `/login?next=%2Frewards` requests a URL with `provider=google` and
      `redirect_to` ending `/auth/callback/google`.
    - The `gc_oauth_next` cookie is `/rewards`.
  - `"cancel at Google lands on the login page with the Google message"`: `goto("/auth/callback/google?error=access_denied")`
    leads to `/login?error=google` and the text `เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง`.
  - `"register page has the working Google button too"`: same URL check from `/register`.
- [ ] **Step 2: Run** `npx playwright test --project=chromium tests/e2e/google-signin.spec.ts`. Expected: FAIL.
  The button still shows the placeholder, and the route is a 404.
- [ ] **Step 3: Implement** the button, the route and the config env.
- [ ] **Step 4: Run** the spec on chromium and mobile-chrome, plus `tests/e2e/auth*.spec.ts` (the existing auth specs).
  Expected: PASS.
  - Any existing spec that asserts `ยังไม่เปิดให้ใช้งาน` must still pass with the flag on.
  - If one breaks, it moves to assert the flag-off placeholder through a unit or render test, recorded as a ruling.
- [ ] **Step 5: Run** `npm run lint` and `node tests/redesign/check-scope.mjs`. Expected: 0 errors, `scope OK`.
- [ ] **Step 6: Commit.** Message: `feat: sign in with Google`.

### Task 3: Guide, local config, env example

**Files:**
- Create: `docs/google-signin.md`
- Modify: `supabase/config.toml`. In `[auth.external.google]`:
  - `enabled = false`, so a machine without keys still starts;
  - `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`;
  - `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`;
  - `skip_nonce_check = true` for local use;
  - add `http://localhost:3000/auth/callback/google` to `additional_redirect_urls`.
- Modify: `.env.example`. Add `NEXT_PUBLIC_GOOGLE_AUTH=` with a comment, and the two `SUPABASE_AUTH_EXTERNAL_GOOGLE_*`
  names with empty values.
- Modify: `docs/deploy.md`. One line pointing at the guide.

- [ ] **Step 1:** Write the guide in Thai, in numbered steps. Name every screen and field:
  1. Google Cloud Console: create or pick a project; OAuth consent screen (External, app name, support e-mail,
     publish); Credentials → OAuth client ID → Web application.
     - Authorized JavaScript origins: the Vercel domain.
     - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
  2. Supabase Dashboard: Authentication → Sign In / Providers → Google: enable, paste the Client ID and Secret, save.
     Then Authentication → URL Configuration → Redirect URLs: add `https://<domain>/auth/callback/google`.
  3. Vercel: Environment Variables → `NEXT_PUBLIC_GOOGLE_AUTH=on` → redeploy (`NEXT_PUBLIC_` values are baked in at build).
  4. Local (optional):
     - Add a second OAuth client redirect `http://127.0.0.1:54321/auth/v1/callback`.
     - Set the two env vars and `enabled = true` locally (do not commit that change).
     - Restart with `npx supabase stop` and `npx supabase start`.
     - Put `NEXT_PUBLIC_GOOGLE_AUTH=on` in `.env.local`.
  5. How to test: new Google account → student dashboard; same e-mail as an existing account → same points;
     Cancel → Google message.
  6. Never paste the Secret into chat, Git or screenshots.
- [ ] **Step 2: Verify:**
  - `npx supabase stop`, then `npx supabase start`, starts with google disabled.
  - `npx supabase db reset` succeeds.
  - The Task 2 e2e still passes.
- [ ] **Step 3: Commit.** Message: `docs: Google sign-in setup guide`.

### Task 4: Full gate

- [ ] Run the full gate in order:
  1. `npx supabase db reset`
  2. `npx supabase test db`
  3. `npm test`
  4. `npm run test:e2e`
  5. `npx supabase db reset`
  6. `npm run test:seed`
  7. `npm run test:e2e:prod`
  8. `npm run lint`
  9. `npx tsc -p scripts/tsconfig.json`
  10. `npm run build`
  11. `node tests/redesign/check-scope.mjs`

  Expected: everything green.
