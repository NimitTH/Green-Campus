# Redesign 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This round adds four things:
- Profile pictures, email change and password change.
- One sticky navbar and footer that is session-aware on every non-staff page.
- Search, sort, view switching and pagination for articles and activities.
- Activity cover images, activity details and creator names.

**Architecture:**
- **Navbar:** `SiteHeader` stays a server component. Its account area is the only part that reads the session, inside `<Suspense>`, so `/` and `/articles` become partial prerender (◐).
- **Data:** new columns and buckets come through migrations 0027–0030. Creator and author names come from a `security definer` function `staff_names()`.
- **Lists:** query params (`q`, `sort`, `view`, `page`) are parsed by a shared `parseListParams`. Search and paging run in Postgres (`ilike`, `range`, exact `count`).

**Tech Stack:**
- Next.js 16.4.2 App Router (Cache Components), React 19, Tailwind 4.
- Supabase (Postgres, Auth, Storage) with pgTAP.
- Tests: Vitest (node env, `renderToStaticMarkup` + `createElement`) and Playwright (chromium + mobile-chrome).

**Spec:** `docs/DESIGN-3.md`. Read it with this plan. Its §-numbers are cited throughout, and its §1.3 table is the only source of new UI copy.

## Global Constraints

- Branch `redesign-3`. Stage explicit paths only. Never use `git commit -a`, `git add -A` or `git add .`. Run `git diff --cached --stat` before every commit.
- Never stage `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`, `.agents/`, `.claude/` or `skills-lock.json`.
- No new dependencies. No `npm --force` or `--legacy-peer-deps`.
- Never edit existing files in `supabase/migrations/` (0001–0026) or `supabase/tests/`. Add new files only.
- UI copy may change only as listed in DESIGN-3 §1.3. Existing `data-testid` attributes and field names stay.
- `/staff/**` keeps its own chrome. It never renders `SiteHeader` or `SiteFooter`.
- `/` and `/articles` must show ◐ in `npm run build` output, not ƒ.
- Before every commit, run the full gate (HANDOFF §9):
  - `npx supabase db reset`
  - `npx supabase test db`
  - `npm test`
  - `npm run test:e2e`
  - `npm run test:seed`
  - `npm run test:e2e:prod`
  - `npm run lint`
  - `npx tsc -p scripts/tsconfig.json`
  - `npm run build`
  - `node tests/redesign/check-scope.mjs`
- Run long gate commands in the background. Kill any stale `next dev` on :3000 before e2e.
- Before using a Next API, read the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md rule).
- Commit messages are `feat: …`, `fix: …` or `docs: …` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never merge or push.

## Review Focus

1. **Search text with PostgREST metacharacters** (`,`, `(`, `)`, `"`, `\`, `%`, `_`, `*`). The search must treat them literally and must never 500. Test: Task 7 Step 1 (`toIlikePattern` / `quoteOrValue` units) and Task 7 Step 9 e2e (`a,b"(%` → empty state).
2. **`page` beyond the last page, or junk** (`page=999`, `page=-3`, `page=abc`, `sort=xyz`, `view=grid`). The list shows the last or first page and the defaults, never an error. Test: Task 7 Step 1 (`parseListParams`) and Task 7 Step 9 (`page=999` shows the last page).
3. **Avatar upload of a non-image, a huge photo or a slow decode.** The user gets a Thai error, and the old avatar stays untouched. Test: Task 2 Step 1 (`cropSquareToJpeg` rejects `not_image`) and Task 2 Step 8 e2e (uploading a `.txt` shows the error and the `<img>` is unchanged).
4. **Wrong current password on email or password change.** The field error reads "รหัสผ่านปัจจุบันไม่ถูกต้อง", the session cookie is unchanged and the user is still signed in. Test: Task 3 Step 8 e2e (after the wrong-password attempt, `/dashboard` still loads without redirecting).
5. **Teacher/admin opening public pages.** The navbar shows the staff dropdown, with no student centre nav and no bottom nav. Test: Task 4 Step 1 render test (teacher variant) and Task 4 Step 8 e2e.

---

### Task 1: Migrations 0027–0030, pgTAP, scope tool

**Files:**
- Create:
  - `supabase/migrations/0027_avatars.sql`
  - `supabase/migrations/0028_activity_content.sql`
  - `supabase/migrations/0029_staff_names.sql`
  - `supabase/migrations/0030_home_feed_cover.sql`
- Create:
  - `supabase/tests/avatars.test.sql`
  - `supabase/tests/activity_content.test.sql`
  - `supabase/tests/staff_names.test.sql`
  - `supabase/tests/home_feed_cover.test.sql`
- Modify:
  - `tests/redesign/check-scope.mjs`
  - `supabase/config.toml` (add `http://localhost:3000/auth/callback/email` to `additional_redirect_urls`)
- Create: `tests/redesign/ui-strings-3.allow.txt` (empty header for now; later tasks append)

**Interfaces:**
- Produces, SQL:
  - `profiles.avatar_path text`
  - bucket `avatars`
  - `activities.cover_path text`, `activities.details text`
  - bucket `activity-images`
  - `public.staff_names(p_ids uuid[]) returns table (id uuid, name text)`
  - `public.leaderboard(p_period text, p_now timestamptz default now())`, which now also returns `avatar_path text` as the last column
  - `public.home_open_activities(p_limit int)`, which now also returns `cover_path text` as the last column
- Produces, scope tool:
  - `check-scope.mjs` reads `ui-strings-3.allow.txt` (lines `text:…` / `aria:…`) as allowed new strings.
  - It reads `ui-strings-3.removed.txt` (same format) as strings allowed to disappear.
  - It allows changes under `src/lib/`, `src/app/actions/`, `src/app/auth/` and `supabase/config.toml`, plus new files in `supabase/migrations/` and `supabase/tests/`.
  - It still fails on a **modified or deleted** existing migration or test file.

- [ ] **Step 1: Write the pgTAP files (failing).** Use the same structure as `supabase/tests/public_home_feed.test.sql`: `begin; select plan(n); … select * from finish(); rollback;`, users seeded via `auth.users` insert, and `set local role` with `request.jwt.claims`. Required assertions:
  - **`avatars.test.sql`:**
    - `has_column('profiles','avatar_path')`.
    - Update `avatar_path` to `'<own id>/<uuid>.jpg'` as that user: `lives_ok`.
    - Set it to `'<other id>/<uuid>.jpg'`: `throws_ok` 23514.
    - Set it to `'<own id>/<uuid>.png'`: `throws_ok` 23514.
    - Anon update: affects 0 rows / `throws_ok` 42501.
    - Bucket `avatars` exists with `public = true`, `file_size_limit = 524288` and `allowed_mime_types = '{image/jpeg}'`.
    - Insert into `storage.objects` (`bucket_id='avatars'`, `name='<own id>/x.jpg'`) as owner: `lives_ok`. As another user: `throws_ok` 42501.
    - `leaderboard('all')` has the column `avatar_path`. For a seeded student with carbon and an avatar, it returns that path, and `rank`/`is_me` are unchanged from a control query computed the same way as `supabase/tests/` existing leaderboard tests.
  - **`activity_content.test.sql`:**
    - Both columns exist.
    - `details` of `repeat('ก',20001)`: `throws_ok` 23514. 20000 characters: `lives_ok`.
    - `cover_path` with a prefix ≠ id: 23514.
    - Bucket `activity-images` exists (public, 2097152).
    - A student inserting an object into `activity-images`: 42501. A teacher: `lives_ok`.
  - **`staff_names.test.sql`:**
    - As anon, `staff_names(array[teacher, admin, student, gen_random_uuid()])` returns exactly 2 rows.
    - A teacher with `display_name = '  '` returns `full_name`.
    - With `display_name = 'ครูเอ'`, it returns `'ครูเอ'`.
    - An array of 150 ids returns at most 100 rows evaluated (assert no error).
  - **`home_feed_cover.test.sql`:** `home_open_activities(3)` includes the column `cover_path` and returns the seeded cover for an open activity.

- [ ] **Step 2: Run `npx supabase db reset; npx supabase test db`.** Expected: the new files FAIL (missing columns and functions). All old files PASS.

- [ ] **Step 3: Write the migrations** following DESIGN-3 §7.1–§7.4. Notes:
  - Copy the latest `leaderboard` body from the newest migration that defines it (`grep -l "function public.leaderboard" supabase/migrations/*`). Drop it with its exact signature, recreate it adding only `avatar_path` (`p.avatar_path`) to the select and the returns table, then re-apply the exact revoke/grant lines of the previous definition.
  - Do the same for `home_open_activities` from 0026, adding `a.cover_path`.
  - Model the `activity-images` policies on `0020_articles.sql` lines 37–56.
  - In the `avatars` policies, use `(storage.foldername(name))[1] = (select auth.uid())::text`.
  - Check whether `activities` uses column-level grants (`grep -n "grant .* on public.activities" supabase/migrations/*`). If it does, grant `cover_path` and `details` the same way.

- [ ] **Step 4: Run `npx supabase db reset; npx supabase test db`.** Expected: all PASS. The old count was 1042, plus the new tests.

- [ ] **Step 5: Update `check-scope.mjs`** as described in Interfaces. The forbidden-path check must keep failing for `git diff --name-status main...HEAD` entries with status `M` or `D` under `supabase/migrations/` or `supabase/tests/`. Run `node tests/redesign/check-scope.mjs`. Expected: `scope OK`.

- [ ] **Step 6: Run the full gate**, then commit:

```bash
git add supabase/migrations/0027_avatars.sql supabase/migrations/0028_activity_content.sql supabase/migrations/0029_staff_names.sql supabase/migrations/0030_home_feed_cover.sql supabase/tests/avatars.test.sql supabase/tests/activity_content.test.sql supabase/tests/staff_names.test.sql supabase/tests/home_feed_cover.test.sql tests/redesign/check-scope.mjs tests/redesign/ui-strings-3.allow.txt supabase/config.toml
git commit -m "feat: redesign 3 schema (avatars, activity content, staff names)"
```

---

### Task 2: Avatar component, current-user avatar, profile picture upload

**Files:**
- Create:
  - `src/lib/profile/avatar.ts` (`avatarInitial`, `AVATAR_BUCKET = "avatars"`, `isOwnAvatarPath`, `avatarPublicUrl`) + `src/lib/profile/avatar.test.ts`
  - `src/components/ui/avatar.tsx`, export it from `src/components/ui/index.ts`
  - `src/app/_components/avatar-section.tsx` (client: upload/remove)
- Modify:
  - `src/lib/image.ts` + `src/lib/image.test.ts` (add `cropSquareToJpeg`)
  - `src/lib/auth/dal.ts` (`avatarUrl`)
  - `src/app/actions/profile.ts` (`setAvatar`, `removeAvatar`)
  - `src/app/_components/account-sections.tsx` (add the section first)
  - `src/app/ui.test.ts` or `src/components/ui/ui.test.ts` (Avatar render)
- Test: `tests/e2e/profile.spec.ts` (add a describe block)

**Interfaces:**
- Produces:
  - `avatarInitial(name: string): string`
  - `isOwnAvatarPath(path: string, userId: string): boolean`
  - `avatarPublicUrl(path: string | null): string | null`
  - `Avatar({ name, url, size }: { name: string; url: string | null; size: 28 | 36 | 48 | 72; className?: string })`
  - `CurrentUser.avatarUrl: string | null`
  - `setAvatar(path: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `removeAvatar(): Promise<{ ok: true } | { ok: false; error: string }>`
  - `cropSquareToJpeg(file: File, edge?: number /* 384 */, options?: ResizeOptions): Promise<Blob>`, which rejects with `ImageError` like `resizeToJpeg` and stays ≤ 524288 bytes or throws `image_too_large`

- [ ] **Step 1: Write the failing unit tests:**
  - `avatarInitial`:
    - `"มานี ใจดี"` → `"ม"`; `"เอก"` → `"อ"`; `"ไพลิน"` → `"พ"`
    - `"  somchai"` → `"S"`; `""` → `"?"`; `"   "` → `"?"`
  - `isOwnAvatarPath(\`${uid}/${uuid}.jpg\`, uid)` → true. Another uid, `.png`, `../` or an extra segment → false.
  - `cropSquareToJpeg` with a fake codec: decodes 800×600, and `encode` receives a square crop (assert the codec's `encodeRegion` gets `sx=100, sy=0, size=600` and output 384×384). An empty file → `ImageError("not_image")`.
  - Avatar render: with `url` it renders `<img` with `alt=""`; without it, it renders the initial inside an `aria-hidden` span.

- [ ] **Step 2: Run `npx vitest run src/lib/profile src/lib/image.test.ts`.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Extend `ImageCodec` with an optional `encodeRegion(source, sx, sy, size, edge, quality)`. The browser codec draws with the 9-arg `drawImage`.
  - `cropSquareToJpeg` reuses the quality steps and has a 512 KB cap.
  - In `avatarInitial`, skip leading `[เแโใไ]` and use `Intl.Segmenter("th", { granularity: "grapheme" })`.
  - In `dal.ts`, add `avatar_path` to the select and map it through `avatarPublicUrl`.

- [ ] **Step 4: Run the unit tests.** Expected: PASS.

- [ ] **Step 5: Server actions.**
  - `setAvatar` returns `GENERIC_ERROR_TH` if `!isOwnAvatarPath`.
  - It reads the old path, then `update({ avatar_path: path })`.
  - On success it removes the old object when it differs (an error is logged and ignored), then revalidates `/profile`, `/staff/profile`, `/dashboard` and `/leaderboard`.
  - `removeAvatar` sets null, removes the object and revalidates the same paths.

- [ ] **Step 6: `AvatarSection` UI** following DESIGN-3 §2 G and §4.2:
  - The flow is file input (`accept="image/*"`) → `cropSquareToJpeg` → `createBrowserClient().storage.from(AVATAR_BUCKET).upload(\`${userId}/${crypto.randomUUID()}.jpg\`, blob, { contentType: "image/jpeg", upsert: false })` → `setAvatar` → `router.refresh()`.
  - Map errors with `errorMessageTh` / `uploadErrorCode` the way `article-form.tsx` lines 66–90 does.
  - Buttons: "อัปโหลดรูป", plus "ลบรูป" (only when it has an avatar).
  - Append the new strings to `ui-strings-3.allow.txt`.

- [ ] **Step 7: Write the e2e** in `profile.spec.ts`, as a student:
  - Upload `PNG_1X1` (helpers/images) → the profile `<img>` src contains `/avatars/`.
  - "ลบรูป" → the initial is visible and there is no `<img>`.
  - Uploading a `.txt` buffer shows a Thai error, and the avatar stays unchanged.

- [ ] **Step 8: Run `npx playwright test tests/e2e/profile.spec.ts`.** Expected: PASS on both projects.

- [ ] **Step 9: Run the full gate**, then commit:

```bash
git add src/lib/profile/avatar.ts src/lib/profile/avatar.test.ts src/components/ui/avatar.tsx src/components/ui/index.ts src/app/_components/avatar-section.tsx src/lib/image.ts src/lib/image.test.ts src/lib/auth/dal.ts src/app/actions/profile.ts src/app/_components/account-sections.tsx src/components/ui/ui.test.ts tests/e2e/profile.spec.ts tests/redesign/ui-strings-3.allow.txt
git commit -m "feat: profile pictures"
```

---

### Task 3: Change email, change password, email callback, remove theme section

**Files:**
- Create:
  - `src/lib/auth/verify-password.ts` (server-only)
  - `src/lib/auth/account-validation.ts` + test
  - `src/app/auth/callback/email/route.ts`
  - `src/app/_components/email-form.tsx`, `src/app/_components/password-form.tsx`
  - `src/components/ui/password-input.tsx` (used here and in Task 5)
- Modify:
  - `src/lib/auth/email-links.ts` + test (flow `email`)
  - `src/app/actions/profile.ts` (`changeEmail`, `changePassword`)
  - `src/app/_components/account-sections.tsx` (remove the theme section; add the email and password sections; show the `?email=` notice)
  - `src/app/(student)/profile/page.tsx` and `src/app/staff/profile/page.tsx` (pass `searchParams.email`; the student→staff redirect keeps the query)
- Test: `tests/e2e/profile.spec.ts`, `tests/e2e/theme.spec.ts` (drop assertions about the profile theme section)

**Interfaces:**
- Consumes: `CurrentUser.email`.
- Produces:
  - `verifyPassword(email: string, password: string): Promise<boolean>`, using a fresh `createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })` and `signInWithPassword`, followed by `signOut({ scope: "local" })` on that client.
  - `validateEmailChange({ newEmail, currentEmail, currentPassword }): Partial<Record<"newEmail"|"currentPassword", string>>`
  - `validatePasswordChange({ currentPassword, newPassword }): Partial<Record<"currentPassword"|"newPassword", string>>`
  - `changeEmail(input) / changePassword(input): Promise<{ ok: true; message: string } | { ok: false; error?: string; fieldErrors?: {...} }>`
  - `PasswordInput(props: InputHTMLAttributes<HTMLInputElement>)`: renders the input with `pr-12` and a 44×44 toggle button (`aria-pressed`, `aria-controls={id}`, label "แสดงรหัสผ่าน" / "ซ่อนรหัสผ่าน").
  - `CALLBACK_PATHS.email = "/auth/callback/email"`
  - `CALLBACK_TARGETS.email = { success: "/profile?email=changed", failure: "/profile?email=link-error" }`

- [ ] **Step 1: Write the failing unit tests:**
  - Email change errors:
    - same email (case-insensitive) → `newEmail` error
    - malformed email → the error from the existing `validateSignUp` email message
    - empty password → "กรอกรหัสผ่าน"
  - Password change errors:
    - a new password shorter than `MIN_PASSWORD_LENGTH` → the `validatePassword` text
    - new equals current → the existing `same_password` message from `messages.ts`
  - `email-links`: the new flow's path and targets.

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement the validation, `verifyPassword`, both actions and the callback route.**
  - Action order: shape check → `getCurrentUser` → validate → `verifyPassword` (false → `fieldErrors.currentPassword = "รหัสผ่านปัจจุบันไม่ถูกต้อง"`) → `updateUser`.
  - `changeEmail` passes `emailRedirectTo: resolveSiteOrigin(...) + CALLBACK_PATHS.email`, built the same way `src/lib/auth/actions.ts` builds signup links.
  - Map Supabase errors through `authErrorMessageTh` (or whatever exists in `messages.ts`) and fall back to `GENERIC_ERROR_TH`.
  - Never log passwords.
  - Success messages are exactly the DESIGN-3 §4.3 and §4.4 strings.

- [ ] **Step 4: Run the unit tests.** Expected: PASS.

- [ ] **Step 5: UI.**
  - Each form follows the pattern of `profile-form.tsx` (pending state, field errors, a `role="status"` success message, fields cleared on success).
  - The password label row has the "ลืมรหัสผ่าน?" link to `/forgot-password`.
  - The email section shows "อีเมลปัจจุบัน: {email}".
  - Remove the theme section and its strings, and list the removed strings in `tests/redesign/ui-strings-3.removed.txt`.
  - Add new strings to the allow file.

- [ ] **Step 6: Write the e2e:**
  - Wrong current password on the password form → "รหัสผ่านปัจจุบันไม่ถูกต้อง", and `/dashboard` still loads.
  - Correct password → success, then sign out and sign in with the new password.
  - Email form with a wrong password → field error.
  - Email form with the correct password → the success message, and Mailpit (`http://127.0.0.1:54324/api/v1/search?query=to:<new>`) has ≥ 1 message within 10 s.
  - `/profile?email=changed` shows "เปลี่ยนอีเมลแล้ว".
  - The profile page has no "ธีม" section heading.
  - The eye button toggles `type` between `password` and `text`.

- [ ] **Step 7: Run `npx playwright test tests/e2e/profile.spec.ts tests/e2e/theme.spec.ts`.** Expected: PASS.

- [ ] **Step 8: Run the full gate**, then commit:

```bash
git add src/lib/auth/verify-password.ts src/lib/auth/account-validation.ts src/lib/auth/account-validation.test.ts src/lib/auth/email-links.ts src/lib/auth/email-links.test.ts src/app/auth/callback/email/route.ts src/app/_components/email-form.tsx src/app/_components/password-form.tsx src/components/ui/password-input.tsx src/app/actions/profile.ts src/app/_components/account-sections.tsx "src/app/(student)/profile/page.tsx" src/app/staff/profile/page.tsx tests/e2e/profile.spec.ts tests/e2e/theme.spec.ts tests/redesign/ui-strings-3.allow.txt tests/redesign/ui-strings-3.removed.txt
git commit -m "feat: change email and password from the profile page"
```

---

### Task 4: Shared navbar and footer on every non-staff page

**Files:**
- Create:
  - `src/app/_components/header-account.tsx` (server)
  - `src/app/_components/account-menu.tsx` (client)
  - `src/app/_components/main-nav.tsx` (client)
  - `src/app/_components/less-source-link.tsx`
  - `src/app/_components/header-account.test.ts`
- Modify:
  - `src/app/_components/site-header.tsx`, `src/app/_components/site-footer.tsx`
  - `src/app/_components/social-links.ts` + test
  - `src/app/(student)/layout.tsx` (use `SiteHeader` + `SiteFooter`, drop its own header)
  - `src/app/(student)/_components/student-nav.tsx` (bottom nav with 4 items; remove `StudentTopNav`)
  - `src/components/ui/theme-toggle.tsx` and `src/components/NotificationBell.tsx` (ghost style)
  - `src/app/_components/home/problem-section.tsx`, `src/app/_components/home/facts-section.tsx`
- Test:
  - `tests/e2e/nav.spec.ts`, `tests/e2e/home.spec.ts`, `tests/e2e/theme.spec.ts`
  - `tests/e2e/articles.spec.ts` (any locator relying on "เข้าสู่ระบบ / หน้าของฉัน" or the old nav)

**Interfaces:**
- Consumes: `Avatar`, `CurrentUser.avatarUrl`, `SignOutButton`.
- Produces:
  - `HeaderAccountView({ user }: { user: Pick<CurrentUser, "role" | "fullName" | "displayName" | "email" | "avatarUrl"> | null })`, a pure view used by the async `HeaderAccount` and by tests.
  - `AccountMenu({ name, email, avatarUrl, links }: { …; links: { href: string; label: string }[] })`
  - `MAIN_NAV_ITEMS` (6 items, DESIGN-3 §1.3).
  - `LESS_URL = "https://ghgreduction.tgo.or.th/th/calculation/less-calculate-document/less-waste/item/548-less-wm-01.html"`

- [ ] **Step 1: Write the failing render tests** (`header-account.test.ts`):
  - `HeaderAccountView({ user: null })` contains "เข้าสู่ระบบ" (`href="/login"`) and "สมัครสมาชิก" (`href="/register"`), and neither "เข้าสู่ระบบ / หน้าของฉัน" nor "หน้าหลัก".
  - Student: contains all 6 `MAIN_NAV_ITEMS` labels, `aria-label="เมนูบัญชี"`, and no `>ฉัน<`.
  - Teacher: no "ผลที่ส่ง", and the menu links include `/staff` "หน้าผู้ดูแล" and `/staff/profile`.
  - `visibleSocialLinks()` has length 5, and every `href === "/"`.

- [ ] **Step 2: Run `npx vitest run src/app/_components`.** Expected: FAIL.

- [ ] **Step 3: Implement** following DESIGN-3 §3.
  - `SiteHeader` renders the logo link `/`, then `<Suspense fallback={<HeaderAccountSkeleton/>}><HeaderAccount/></Suspense>`. The skeleton has a fixed width and height and is `aria-hidden`.
  - `AccountMenu` is a disclosure:
    - `useState` for open; Escape closes it and focuses the button; a `pointerdown` outside closes it.
    - `usePathname` change closes it, read inside the component under the header's Suspense.
    - It uses unique ids via `useId` (the `<Activity>` duplicate-id rule).
  - `main-nav.tsx` copies the `withPathname` Suspense pattern from the old `student-nav.tsx`.
  - Bottom nav `BOTTOM`: drop the `/profile` item and keep the match arrays.
  - Ghost class for the toggle and the bell: DESIGN-3 §3.5.
  - Use `LessSourceLink` in the 3 places.
  - `(student)/layout.tsx` keeps its bottom padding and `BottomNav`, and adds `SiteFooter` before `BottomNav`.

- [ ] **Step 4: Run the unit tests.** Expected: PASS.

- [ ] **Step 5: Run `npm run build`.** Expected: `/` and `/articles` are ◐, with no prerender error about uncached data outside Suspense.

- [ ] **Step 6: Write the e2e** (`nav.spec.ts` + `home.spec.ts`):
  - **Anon on `/`:** the "เข้าสู่ระบบ" link goes to `/login`, and there is no `nav[aria-label="เมนูหลัก"]`.
  - **Student:**
    - On `/articles`, it sees the 6 centre items (desktop only, `test.skip` on mobile-chrome) and no "ฉัน".
    - Clicking `เมนูบัญชี` shows the name, email and "โปรไฟล์". Escape hides the panel and the button is focused. "ออกจากระบบ" leads to the logged-out header.
  - **Teacher on `/`:** the menu has "หน้าผู้ดูแล".
  - **Logo:** clicking it from `/activities` gives URL `/`.
  - **Sticky header:** after `window.scrollTo(0,1500)` the header's `boundingBox().y === 0` on `/dashboard` and `/activities`.
  - **Footer:** visible on `/`, `/articles`, `/login`, `/dashboard`, `/profile`, and count 0 on `/staff` (as a teacher).
  - **LESS link:** `a[href^="https://ghgreduction.tgo.or.th"]` count ≥ 2 on `/`.
  - **Mobile-chrome:** the bottom nav has exactly 4 links.
  - **360px:** no horizontal scroll on `/dashboard` while signed in.

- [ ] **Step 7: Fix old e2e locators that referenced removed copy.** Update the tests, not the app.

- [ ] **Step 8: Run `npx playwright test tests/e2e/nav.spec.ts tests/e2e/home.spec.ts tests/e2e/theme.spec.ts tests/e2e/articles.spec.ts`.** Expected: PASS.

- [ ] **Step 9: Run the full gate**, then commit, staging each path touched:

```bash
git add src/app/_components/header-account.tsx src/app/_components/account-menu.tsx src/app/_components/main-nav.tsx src/app/_components/less-source-link.tsx src/app/_components/header-account.test.ts src/app/_components/site-header.tsx src/app/_components/site-footer.tsx src/app/_components/social-links.ts src/app/_components/social-links.test.ts "src/app/(student)/layout.tsx" "src/app/(student)/_components/student-nav.tsx" src/components/ui/theme-toggle.tsx src/components/NotificationBell.tsx src/app/_components/home/problem-section.tsx src/app/_components/home/facts-section.tsx tests/e2e/nav.spec.ts tests/e2e/home.spec.ts tests/e2e/theme.spec.ts tests/e2e/articles.spec.ts tests/redesign/ui-strings-3.allow.txt tests/redesign/ui-strings-3.removed.txt
git commit -m "feat: session-aware navbar and footer on every non-staff page"
```

---

### Task 5: Login and register pages

**Files:**
- Create: `src/app/(auth)/_components/google-button.tsx`
- Modify:
  - `src/app/(auth)/login/login-form.tsx` and `src/app/(auth)/login/page.tsx`
  - `src/app/(auth)/register/register-form.tsx` and `src/app/(auth)/register/page.tsx`
  - `src/app/(auth)/reset-password/reset-password-form.tsx` (`PasswordInput` only)
- Test: `tests/e2e/auth.spec.ts` or the existing auth e2e file (`grep -l "เข้าสู่ระบบ" tests/e2e/*.ts`), and `tests/e2e/preserved-forms.spec.ts` if it locates password inputs by role

**Interfaces:**
- Consumes: `PasswordInput` (Task 3).
- Produces: `GoogleButton({ label }: { label: string })`.

- [ ] **Step 1: Write the failing e2e** (chromium + mobile):
  - On `/login`, the description text from DESIGN-3 §1.3 is visible.
  - The "ลืมรหัสผ่าน?" link and the "รหัสผ่าน" label share the same `boundingBox().y` (±4px).
  - The eye button toggles `type`.
  - Clicking "เข้าสู่ระบบด้วย Google" shows "ยังไม่เปิดให้ใช้งาน" and the URL stays `/login`.
  - "ยังไม่มีบัญชี?" + "สมัครสมาชิก" goes to `/register`.
  - On `/register`: the description, "สมัครสมาชิกด้วย Google" and "มีบัญชีแล้ว?" → `/login`.
  - Existing login/register flows still pass.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement** following DESIGN-3 §2 F and §4.6:
  - The Google "G" logo is an inline 4-colour SVG with `aria-hidden`.
  - The divider "หรือ" has rules on both sides.
  - Keep the existing input `name`, `autocomplete` and `data-testid` values.
  - Append the strings to the allow file.

- [ ] **Step 4: Run the e2e.** Expected: PASS.

- [ ] **Step 5: Run the full gate**, then commit the touched paths with the message `feat: login and register polish (password eye, google placeholder)`.

---

### Task 6: Dashboard greeting and avatars on dashboard and leaderboard

**Files:**
- Create: `src/lib/greeting.ts` + `src/lib/greeting.test.ts`
- Modify:
  - `src/app/(student)/dashboard/page.tsx`
  - `src/lib/leaderboard/queries.ts` (+ its test if present)
  - `src/app/(student)/leaderboard/page.tsx`
- Test: `tests/e2e/dashboard.spec.ts`, `tests/e2e/leaderboard.spec.ts`

**Interfaces:**
- Consumes: `Avatar`, `avatarPublicUrl`, `leaderboard()` `avatar_path` (Task 1).
- Produces:
  - `greetingFor(date: Date): "สวัสดีตอนเช้า" | "สวัสดีตอนเที่ยง" | "สวัสดีตอนบ่าย" | "สวัสดีตอนเย็น"`
  - `greetingName(user: { displayName: string | null; fullName: string }): string`
  - `LeaderboardRow.avatarUrl: string | null`

- [ ] **Step 1: Write the failing unit tests.** All times are UTC instants for Bangkok (UTC+7):
  - `greetingFor`:
    - 04:59 BKK (`2026-10-29T21:59Z` of the previous day) → เย็น
    - 05:00 → เช้า; 10:59 → เช้า; 11:00 → เที่ยง; 12:59 → เที่ยง
    - 13:00 → บ่าย; 16:59 → บ่าย; 17:00 → เย็น; 23:30 → เย็น
  - `greetingName`:
    - `{ displayName: "มานี", fullName: "มานี ใจดี" }` → "มานี"
    - `{ displayName: null, fullName: "สมชาย ใจกล้า" }` → "สมชาย"
    - `{ displayName: "  ", fullName: "A B" }` → "A"

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Use `Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })` (check `src/lib/datetime.ts` first and reuse any Bangkok hour helper).
  - The dashboard heading is `${greetingFor(new Date())} ${greetingName(user)}`, computed after `requireUser()`.
  - Below it: `Avatar` 72px, `fullName` and `email` (DESIGN-3 §4.5).
  - The leaderboard row shows `Avatar` 28px before the name.

- [ ] **Step 4: Run the unit tests.** Expected: PASS.

- [ ] **Step 5: Write the e2e:**
  - Dashboard with `page.clock.setFixedTime(new Date("2026-10-29T02:00:00Z"))` (09:00 BKK) shows `สวัสดีตอนเช้า`.
  - Full name and email are visible.
  - On the leaderboard, a student with an avatar set via the admin client (upload `PNG_1X1` to `avatars/<id>/<uuid>.jpg` and update the profile) shows an `<img>` in their row. Others show initials.
  - Update existing assertions that expected "สวัสดี {name}".

- [ ] **Step 6: Run the e2e.** Expected: PASS.

- [ ] **Step 7: Run the full gate**, then commit with the message `feat: time-of-day greeting and avatars on dashboard and leaderboard`.

---

### Task 7: Shared list components + articles

**Files:**
- Create in `src/app/_components/list/`:
  - `list-params.ts` + `list-params.test.ts`
  - `search-escape.ts` + `search-escape.test.ts`
  - `list-toolbar.tsx`, `view-toggle.tsx`
  - `pagination.tsx` + `pagination.test.ts`
- Create: `src/components/ui/copy-link-button.tsx`, `src/lib/staff-names.ts` (`getStaffNames`)
- Modify:
  - `src/lib/articles/public.ts` (`listPublishedArticlesPage`, `authorName` on `getPublishedArticle`)
  - `src/app/(public)/articles/page.tsx`, `src/app/(public)/articles/[slug]/page.tsx`
- Test: `tests/e2e/articles.spec.ts`

**Interfaces:**
- Produces:
  - `type ListSort = "new" | "old"`, `type ListView = "card" | "list"`
  - `type ListParams = { q: string; sort: ListSort; view: ListView; page: number }`
  - `PAGE_SIZE = 12`
  - `parseListParams(sp: Record<string, string | string[] | undefined>): ListParams`
  - `listHref(base: string, current: ListParams, patch: Partial<ListParams>): string`, which omits defaults and resets `page` to 1 when `q` or `sort` changes
  - `toIlikePattern(q: string): string`, which escapes `\` `%` `_` and wraps in `%`
  - `quoteOrValue(v: string): string`, which wraps in `"…"`, escaping `"` and `\`
  - `pageWindow(current: number, last: number): (number | "…")[]`
  - `ListToolbar({ base, placeholder }: { base: string; placeholder: string })`, which reads `useSearchParams()`
  - `ViewToggle({ base, params })`
  - `Pagination({ base, params, total })`, which returns null when `total <= PAGE_SIZE`
  - `CopyLinkButton()`
  - `getStaffNames(ids: string[]): Promise<Map<string, string>>`, using the anon client, deduped, and returning an empty map on error
  - `listPublishedArticlesPage(p: Pick<ListParams,"q"|"sort"|"page">): Promise<{ items: (PublicArticleSummary & { authorName: string | null })[]; total: number } | null>`

- [ ] **Step 1: Write the failing unit tests:**
  - `parseListParams`:
    - `{}` → `{ q:"", sort:"new", view:"card", page:1 }`
    - `{ page:"-3" }` → 1; `{ page:"abc" }` → 1; `{ page:["2","3"] }` → 2
    - `{ sort:"xyz", view:"grid" }` → defaults
    - `q` is trimmed and cut to 100 characters
  - `listHref("/articles", {q:"a",sort:"new",view:"list",page:3}, {sort:"old"})` → `"/articles?q=a&sort=old&view=list"`
  - `toIlikePattern("50%_off\\")` → `"%50\\%\\_off\\\\%"`
  - `quoteOrValue('a,"b')` → `"\"a,\\\"b\""`
  - `pageWindow`:
    - `(1,1)` → `[1]`
    - `(5,10)` → `[1,"…",4,5,6,"…",10]`
    - `(2,4)` → `[1,2,3,4]`
  - Pagination render with `total = 12` → empty string.

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement the list helpers and components** following DESIGN-3 §5.3.
  - The search form is `<form method="get" role="search" action={base}>` with hidden `sort` and `view` inputs.
  - The sort `<select>` triggers `router.replace(listHref(...))` on change.
  - A no-JS submit button stays `sr-only` and becomes visible on focus.

- [ ] **Step 4: Implement `listPublishedArticlesPage`** with `'use cache'`, `cacheTag(ARTICLES_TAG)` and the anon client.
  - Query: `.select("id, slug, title, body, cover_path, created_at, author_id", { count: "exact" })`, `.eq("published", true)`.
  - When `q` is set, add `.or(\`title.ilike.${quoteOrValue(toIlikePattern(q))},body.ilike.${quoteOrValue(toIlikePattern(q))}\`)`.
  - Order by `created_at`, then `id`, with ascending = `sort === "old"`, and `.range((page-1)*12, page*12-1)`.
  - Then `getStaffNames(authorIds)`.
  - Error → `cacheLife("seconds")`, return null. Otherwise `cacheLife("minutes")`.
  - `getPublishedArticle` adds `authorName`.
  - Run `node tests/redesign/check-scope.mjs`. If `use-cache-count` changed, update the baseline with `--write-baseline` and record the reason in DESIGN-3 §10.

- [ ] **Step 5: Pages.**
  - `/articles`:
    - The heading is static.
    - `<Suspense fallback={<ToolbarSkeleton/>}><ListToolbar base="/articles" placeholder="ค้นหาบทความ"/></Suspense>`
    - `<Suspense fallback={<PageSkeleton/>}><ArticleResults searchParams={props.searchParams}/></Suspense>`, which awaits the params, parses them, fetches, and re-fetches the last page when `page > lastPage`.
    - It renders the card grid or list rows plus `Pagination`.
    - Empty with `q` → "ไม่พบบทความที่ตรงกับคำค้น" + "ล้างการค้นหา" (`href="/articles"`).
    - Card and row content: DESIGN-3 §5.1.
  - `/articles/[slug]`: the DESIGN-3 §5.2 order, the "โดย {authorName ?? "-"}" row, and `CopyLinkButton` on the right.

- [ ] **Step 6: Run the unit tests and `npm run build`.** Expected: PASS. `/articles` is ◐.

- [ ] **Step 7: Write the e2e** (`articles.spec.ts`). Seed 13 published articles with a unique prefix through the admin client; the first has `author_id` = a teacher with `display_name` "ครูทดสอบ", the rest have none.
  - `?q=<prefix>` → 12 items. Page 2 → 1 item.
  - `sort=old` makes the first item the oldest.
  - Clicking "รายการ" → URL contains `view=list`, and rows are rendered.
  - `?q=a,b"(%` → the empty state, no error page.
  - `?q=<prefix>&page=999` → shows page 2's single item.
  - Detail page: the cover `<img>` comes before the `h1` in DOM order. "โดย ครูทดสอบ" on the authored article, "โดย -" on another.
  - Chromium only, with `context.grantPermissions(["clipboard-read","clipboard-write"])`: "คัดลอกลิงก์" → "คัดลอกแล้ว", and the clipboard equals `page.url()`.
  - Clean up the seeded articles in `afterAll`.

- [ ] **Step 8: Run the e2e.** Expected: PASS.

- [ ] **Step 9: Run the full gate**, then commit the touched paths with the message `feat: article search, sort, view toggle, pagination, author and share link`.

---

### Task 8: Activities (staff form, student list, detail, home cards)

**Files:**
- Modify:
  - `src/lib/activities/validation.ts` + test (`details`, `coverPath`)
  - `src/app/actions/activities.ts` (save and delete cover)
  - `src/app/staff/activities/_components/activity-form.tsx`
  - `src/lib/activities/queries.ts` (`listActivitiesForStudentPage`, extend `COLUMNS`)
  - `src/app/(student)/activities/page.tsx`, `src/app/(student)/activities/[id]/page.tsx`
  - `src/lib/home/public-feed.ts` + test (`coverUrl`)
  - `src/app/_components/home/activities-section.tsx`
- Create:
  - `src/lib/activities/cover.ts` (`ACTIVITY_BUCKET = "activity-images"`, `isActivityCoverPath(path, activityId)`, `activityCoverUrl(path)`) + test
  - `src/app/(student)/activities/_components/activity-card.tsx`
- Test: `tests/e2e/activities.spec.ts`, `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: the list helpers, `getStaffNames`, `CopyLinkButton` (Task 7), and `activityProgress` (existing).
- Produces:
  - `ActivityInput.details: string`, `ActivityRecord.details: string | null`, `LIMITS.detailsMax = 20000`
  - `listActivitiesForStudentPage(userId: string, p: Pick<ListParams,"q"|"sort"|"page">): Promise<{ items: (ActivityRow & { joined: boolean; creatorName: string | null; coverUrl: string | null })[]; total: number }>`
  - `PublicActivity.coverUrl: string | null`

- [ ] **Step 1: Write the failing unit tests:**
  - `validateActivity`:
    - `details` of 20001 characters → a field error
    - empty `details` → `details: null`
    - 20000 characters → ok
  - `isActivityCoverPath`: the own id → true, another id → false.
  - `parseOpenActivities` maps `cover_path` to `coverUrl`, and null stays null.

- [ ] **Step 2: Run the tests.** Expected: FAIL.

- [ ] **Step 3: Implement the validation, cover helpers and actions.**
  - Mirror the article cover flow: `saveArticle` cover handling in `src/app/actions/articles.ts` and the upload in `article-form.tsx` lines 59–120.
  - A new activity is inserted first, then the cover is uploaded to `${id}/${uuid}.jpg`, then `cover_path` is updated.
  - Replacing or removing a cover deletes the old object. `deleteActivity` deletes the cover object.
  - Revalidate `/activities`, `/activities/${id}` and `/staff/activities`.
  - If `public-feed.ts` uses a cache tag, `updateTag` it. Otherwise rely on `cacheLife("minutes")`, and note that in the commit body.

- [ ] **Step 4: Staff form.** Add the fields "ภาพปก" and "รายละเอียดกิจกรรม" (a textarea with a counter, `maxLength` 20000). Append the strings.

- [ ] **Step 5: Implement the student list and detail.**
  - `listActivitiesForStudentPage` keeps the existing visibility filter: `status.eq.open` or joined ids. Combine it with search as `.or(\`status.eq.open,id.in.(…)\`)` **and** a second `.or(title.ilike…,description.ilike…)`. PostgREST ANDs separate `.or()` calls.
  - Order by `created_at`, then `id`, with `range` and exact `count`.
  - One `getStaffNames` call per page.
  - The page uses the shared toolbar, view toggle and pagination with base `/activities`, placeholder "ค้นหากิจกรรม", and the "เข้าร่วมแล้ว" badge.
  - Empty states per DESIGN-3 §6.2.
  - Detail: DESIGN-3 §6.3 order, with the creator via `getStaffNames([created_by])` and `details` through `splitParagraphs`.

- [ ] **Step 6: Home cards.** Map `cover_path` in `public-feed.ts`. `activities-section.tsx` shows the cover (`<img alt="">`, `object-cover`, fixed aspect) or the existing surface.

- [ ] **Step 7: Run the unit tests and `npm run build`.** Expected: PASS. `/` is still ◐.

- [ ] **Step 8: Write the e2e:**
  - **Teacher:** creates an activity with the `PNG_1X1` cover and details "บรรทัดแรก\n\nย่อหน้าสอง", then opens it.
  - **Student:**
    - The card shows the cover `<img>` and "โดย <teacher name>".
    - The detail page has the cover before the `h1`, two `<p>` details paragraphs, and "คัดลอกลิงก์".
  - **Pagination:** seed 13 open activities with a unique prefix → `?q=<prefix>` shows 12 items and page 2 shows 1.
  - **Sort and view:** `sort=old` gives oldest first, and `view=list` renders rows.
  - **Special characters:** `?q=%,"` gives the empty state.
  - **Joined badge:** a joined activity shows "เข้าร่วมแล้ว".
  - **Home:** anon `/` shows the cover image on the seeded activity's card.
  - **360px:** no horizontal scroll on `/activities`.
  - Update existing `activities.spec.ts` assertions that relied on the two-section layout.

- [ ] **Step 9: Run the e2e.** Expected: PASS.

- [ ] **Step 10: Run the full gate**, then commit the touched paths with the message `feat: activity covers, details, creator, search and pagination`.

---

### Task 9: Whole-branch review, Impeccable polish, record results

**Files:**
- Modify: `docs/DESIGN-3.md` (status line, §10 results table in the DESIGN-2 §10 format)
- Modify: any UI file the polish pass fixes

- [ ] **Step 1: Run the Impeccable audit** (markdown-only use of the skill, as in redesign 2) over the pages touched by Tasks 2–8:
  - Check contrast in both themes, focus rings, 44px targets, 360px layout, reduced motion and duplicate ids.
  - List the findings, fix those inside the spec, and leave copy as is unless it is listed in DESIGN-3 §1.3.

- [ ] **Step 2: Run the full gate** after `npx supabase db reset`. Expected: everything passes, `/` and `/articles` are ◐, and the output is `scope OK`.

- [ ] **Step 3: Fill DESIGN-3 §10** with the gate counts and the build markers. Set the status to "ใช้งานแล้ว บน branch redesign-3".

- [ ] **Step 4: Commit:**

```bash
git add docs/DESIGN-3.md <polished files>
git commit -m "docs: redesign 3 complete"
```
