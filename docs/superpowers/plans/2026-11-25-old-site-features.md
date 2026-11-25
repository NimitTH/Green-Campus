# Round 6: features from the old site, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five features to Green Campus:
- the waste rate card;
- quick time ranges;
- `ORD-YYYYMMDD-NNNN` order numbers;
- an article display window;
- a website problem report.

**Architecture:**
- Database rules live in new Supabase migrations (0037–0040), with security-definer functions and RLS following
  0036's patterns.
- Next.js 16 server components read request data inside `<Suspense>` (cacheComponents).
- Writes go through server actions in `src/app/actions/`.

**Tech Stack:** Next.js 16.4.6 (App Router, Cache Components), Supabase (Postgres, RLS, pgTAP), Tailwind 4,
vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-old-site-features-design.md`. Read it first; this plan argues from it.

## Global Constraints

- Read `AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.
- No new dependencies.
- Every schema change is a new migration under `supabase/migrations/`, numbered from 0037. Never edit an old migration.
- Every new SQL function has `set search_path = ''`, and `revoke execute ... from public, anon` unless anon needs it.
- UI copy is Thai. Every new visible string or aria-label goes in `tests/redesign/ui-strings-6.allow.txt` (format
  `text:...` / `aria:...`). Task 1 makes `tests/redesign/check-scope.mjs` load that file.
- Touch targets are at least 44 px on phones (`max-md:min-h-11` pattern). Focus stays visible. Pages don't scroll
  sideways at 360 px.
- Commits:
  - Stage explicit paths only. Never `git add -A`, `.` or `-a`.
  - Never stage `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`, `docs/REDESIGN-4-REQUEST.md`,
    `src/app/_components/home/hero.tsx`, `.agents/`, `.claude/` or `skills-lock.json`.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run tests from `C:\Users\Mitr\Documents\my-app` (uppercase C). Docker Desktop and `npx supabase start` must be up.
- If `next dev` or `next build` exits once with SecurityFatalError, retry once.

## Review Focus

1. **Two checkouts in the same second** must get consecutive, different order numbers, never a unique-violation
   error shown to a student. Task 5 tests this in `db-races.spec.ts`.
2. **An order created at 23:59 vs 00:00 Bangkok time (16:59 vs 17:00 UTC)** gets that Bangkok day's date and
   counter. Task 5 pgTAP fakes `now()`, or tests the numbering helper with an explicit timestamp.
3. **An article whose `show_until` passed while it sits in the "minutes" cache** must still return the not-found
   page on a direct slug request once the cache expires, and the RLS rule must hide it from anon right away.
   Task 3 tests RLS directly; the e2e uses a window fully in the future.
4. **A problem report message of only spaces or newlines** is rejected (trimmed length 0), and one of exactly 1000
   Thai characters (multi-byte) is accepted. Task 4 tests both in pgTAP and vitest.
5. **A `?from=` value of `//evil.com` or `https://evil.com/x`** on `/report-problem` must be dropped, never stored
   or shown as a link. Task 4 vitest covers `safeReportPath`.

---

### Task 1: Waste rate card + ui-strings-6 file

**Files:**
- Create: `src/app/(student)/activities/[id]/_components/waste-rate-card.tsx`
- Create: `tests/redesign/ui-strings-6.allow.txt`
- Modify: `src/app/(student)/activities/[id]/page.tsx` (next to `rewardText`, around line 42 and its use)
- Modify: `tests/redesign/check-scope.mjs` (load `ui-strings-6.allow.txt` the way it loads `ui-strings-5.allow.txt`)
- Create: `src/lib/activities/waste-rates.ts`
- Test: `src/lib/activities/waste-rates.test.ts`
- Test: `tests/e2e/activities.spec.ts` (new test)

**Interfaces:**
- Produces: `getWasteRates(): Promise<WasteRate[] | null>` in `src/lib/activities/waste-rates.ts`.
  - `WasteRate = { code: string; name: string; pointsPerKg: number; carbonKgPerKg: number }`.
  - Ordered `plastic, paper, metal_glass, other`, then by name.
  - Returns null on error and never throws.
  - Uses the server client, the same read the submit page uses.

- [ ] **Step 1: Write the failing vitest.** Add `sortWasteRates(rows)` (exported, pure) and the test
  `sortWasteRates puts known codes in fixed order and unknown codes last by name`. Input codes
  `["other","zzz","plastic","paper"]` give `["plastic","paper","other","zzz"]`.
- [ ] **Step 2: Run** `npx vitest run src/lib/activities/waste-rates.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `sortWasteRates` and `getWasteRates` in `src/lib/activities/waste-rates.ts`.
  - The query is `select code, name, points_per_kg, carbon_kg_per_kg from waste_categories`.
  - `numeric` comes back as a string, so convert it with `Number`.
- [ ] **Step 4: Run** the vitest again. Expected: PASS.
- [ ] **Step 5: Write the failing e2e test** `waste activity shows the rate card with every group` in
  `tests/e2e/activities.spec.ts`.
  - Create a waste activity with existing helpers and sign in as a student.
  - Open `/activities/<id>`.
  - Expect `getByRole("table", { name: "อัตราแต้มและ carbon ต่อ กก." })` to be visible, with 4 body rows.
  - Expect the first row to contain the plastic category's name and its `points_per_kg` from the DB.
  - At 360×800, expect `scrollWidth <= clientWidth`.
  - A trees activity shows no such table.
- [ ] **Step 6: Run** `npx playwright test --project=chromium tests/e2e/activities.spec.ts -g "rate card"`.
  Expected: FAIL.
- [ ] **Step 7: Implement** `WasteRateCard({ rates }: { rates: WasteRate[] })`.
  - It renders a `<table>` with `<caption>` `อัตราแต้มและ carbon ต่อ กก.`, columns `กลุ่ม` / `แต้ม/กก.` /
    `carbon กก. CO₂e/กก.`, and numbers in `font-mono`.
  - On the page, render it only when `a.type === "waste"` and `getWasteRates()` is not null.
  - Keep the `rewardText` sentence.
  - Add every new string to `ui-strings-6.allow.txt`, and load that file in check-scope.
- [ ] **Step 8: Run** the e2e and `node tests/redesign/check-scope.mjs`. Expected: PASS and `scope OK`.
- [ ] **Step 9: Commit** these files: `waste-rates.ts`, its test, `waste-rate-card.tsx`, `page.tsx`, the
  activities spec, `ui-strings-6.allow.txt` and `check-scope.mjs`.
  Message: `feat: waste rate card on waste activities`.

### Task 2: Quick time ranges (reports + staff dashboard)

**Files:**
- Create: `supabase/migrations/0037_staff_waste_since.sql`
- Modify: `supabase/tests/staff_charts.test.sql`
- Modify: `src/lib/reports/range.ts`, `src/lib/reports/range.test.ts`
- Modify: `src/app/staff/reports/page.tsx` (preset links above the from/to form, around lines 60–72)
- Modify: `src/lib/admin/queries.ts:75` (`getStaffCharts`)
- Create: `src/lib/admin/chart-range.ts`, `src/lib/admin/chart-range.test.ts`
- Modify: `src/app/staff/page.tsx`. `StaffHome` takes `searchParams`; the chart choices sit above each chart.
- Test: `tests/e2e/staff-shell.spec.ts` or `tests/e2e/reports.spec.ts` (new tests)

**Interfaces:**
- Produces, in `range.ts`:
  - `REPORT_PRESETS = ["7d", "30d", "month", "12m"] as const`
  - `type ReportPreset`
  - `presetRange(preset: ReportPreset, now: Date): DateRange`. All presets end on today's Bangkok date. `month`
    equals `bangkokMonthRange(now)`. `7d` starts 6 days before today, `30d` 29 days before, and `12m` on the same
    day one year earlier, plus one day.
  - `matchPreset(range: DateRange, now: Date): ReportPreset | null`
- Produces, in `chart-range.ts`:
  - `type CarbonMonths = 6 | 12`
  - `type WastePeriod = "30d" | "12m" | "all"`
  - `parseChartRange(params: { months?: string; waste?: string }): { months: CarbonMonths; waste: WastePeriod }`.
    The defaults are 6 and `"all"`; unknown values fall back to them.
  - `wasteSince(period: WastePeriod, now: Date): string | null`, an ISO timestamp or null for `all`.
- Changes: `getStaffCharts(months: CarbonMonths, since: string | null)`. Keep React `cache()`; the arguments become
  the cache key.
- SQL: `public.staff_waste_by_category(p_since timestamptz default null)`.
  - Filters `s.reviewed_at >= p_since` when not null.
  - Drop the old zero-argument function in the same migration and re-grant to `authenticated` only.

- [ ] **Step 1: Write the failing pgTAP tests** in `staff_charts.test.sql`:
  - with `p_since` = now() − 1 day, an approval reviewed 2 days ago isn't counted but one reviewed today is;
  - with null, both are counted;
  - anon is denied.
- [ ] **Step 2: Run** `npx supabase db reset` then `npx supabase test db`. Expected: the new tests FAIL.
- [ ] **Step 3: Write migration 0037.**
- [ ] **Step 4: Run** the db reset and `npx supabase test db`. Expected: PASS.
- [ ] **Step 5: Write the failing vitests:**
  - `presetRange` for each preset at `2026-11-25T03:00:00Z`: `7d` = `2026-11-19..2026-11-25`,
    `30d` = `2026-10-27..2026-11-25`, `month` = `2026-11-01..2026-11-30`, `12m` = `2025-11-26..2026-11-25`;
  - the Bangkok boundary: `2026-11-24T17:30:00Z` is already the 25th;
  - `matchPreset` round-trips each preset;
  - `parseChartRange({ months: "12", waste: "30d" })`;
  - garbage values give the defaults.
- [ ] **Step 6: Run** `npx vitest run src/lib/reports/range.test.ts src/lib/admin/chart-range.test.ts`.
  Expected: FAIL.
- [ ] **Step 7: Implement** `presetRange`, `matchPreset`, `parseChartRange` and `wasteSince`.
- [ ] **Step 8: Run** the vitests. Expected: PASS.
- [ ] **Step 9: Write the failing e2e tests:**
  - On `/staff/reports`, links `7 วัน`, `30 วัน`, `เดือนนี้`, `12 เดือน` are inside
    `getByRole("navigation", { name: "ช่วงเวลารายงาน" })`.
    - Clicking `7 วัน` puts `from` and `to` in the URL.
    - That link gets `aria-current="page"`.
  - On `/staff`, the link `12 เดือน` in `getByRole("navigation", { name: "ช่วงกราฟ carbon" })` sets `?months=12`,
    and the carbon chart's text table has 12 rows.
  - The waste navigation `ช่วงกราฟขยะ` has `30 วัน` / `12 เดือน` / `ทั้งหมด`.
- [ ] **Step 10: Run** them. Expected: FAIL.
- [ ] **Step 11: Implement the UI.**
  - Preset links are `<Link>`s that keep other params.
  - The current choice gets `aria-current="page"` and `max-md:min-h-11`.
  - The dashboard reads `searchParams` inside the existing `<Suspense>` boundaries.
  - Add the strings to `ui-strings-6.allow.txt`.
- [ ] **Step 12: Run** the e2e, `npm run lint` and `node tests/redesign/check-scope.mjs`. Expected: PASS.
- [ ] **Step 13: Commit.** Message: `feat: quick time ranges on reports and the staff dashboard`.

### Task 3: Article display window

**Files:**
- Create: `supabase/migrations/0038_article_window.sql`
- Create: `supabase/tests/article_window.test.sql`
- Modify: `src/lib/articles/format.ts`, `src/lib/articles/format.test.ts`
- Modify: `src/app/actions/articles.ts` (save the two fields, lines 94–140)
- Modify: the staff article editor form under `src/app/staff/articles/` (find the form component that posts
  `category`)
- Modify: `src/app/staff/articles/page.tsx` (badge)
- Test: `tests/e2e/articles.spec.ts`

**Interfaces:**
- SQL:
  - Add columns `articles.show_from timestamptz`, `articles.show_until timestamptz`.
  - Add the constraint `articles_show_window check (show_from is null or show_until is null or show_until > show_from)`.
  - Add `public.article_is_visible(a public.articles) returns boolean` (stable, sql). The body is
    `a.published and (a.show_from is null or a.show_from <= now()) and (a.show_until is null or now() < a.show_until)`.
  - Recreate `articles_select_public` (anon) as `using (public.article_is_visible(articles))`, and `articles_select`
    as `using (public.article_is_visible(articles) or (select public.is_staff()))`.
  - Grep every migration for `published` in functions that read `public.articles` (home feed 0026/0030, staff_names
    if it touches articles), and switch each security-definer reader to `article_is_visible`.
- TS:
  - `ArticleInput` gains `showFrom: string` and `showUntil: string`, each empty or a `datetime-local` value read as
    Bangkok time.
  - `ArticleRecord` gains `showFrom: string | null` and `showUntil: string | null` as ISO strings.
  - `validateArticle` sets `errors.showUntil = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม"` when both are set and
    end <= start.
  - Add `articleWindowState(a: { published: boolean; showFrom: string | null; showUntil: string | null }, now: Date): "visible" | "scheduled" | "expired" | "draft"`.

- [ ] **Step 1: Write the failing pgTAP tests:**
  - As anon and as a student: a published article with `show_from` = now()+1 day is not visible; one with
    `show_until` = now()−1 minute is not visible; one with both null is visible.
  - As staff, all three are visible.
  - The constraint rejects end <= start.
  - The home feed function, if it lists articles, excludes the scheduled one.
- [ ] **Step 2: Run** the db reset and `npx supabase test db`. Expected: FAIL.
- [ ] **Step 3: Write migration 0038.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Write the failing vitests:**
  - `validateArticle` with `showFrom: "2026-12-01T08:00"`, `showUntil: "2026-12-01T07:00"` gives a `showUntil` error.
  - Valid times convert to ISO as Bangkok: `"2026-12-01T08:00"` becomes `"2026-12-01T01:00:00.000Z"`.
  - Empty strings give null.
  - `articleWindowState` returns each of its 4 states.
- [ ] **Step 6: Run** `npx vitest run src/lib/articles/format.test.ts`. Expected: FAIL.
- [ ] **Step 7: Implement** the format changes, then the action and editor:
  - Two `datetime-local` inputs, `แสดงตั้งแต่` and `แสดงถึง`.
  - Help text: `เว้นว่างได้ บทความจะขึ้นหรือหายภายในประมาณ 1 นาทีหลังเวลาที่ตั้ง`.
  - The staff list badge is `รอเวลาแสดง` or `หมดเวลาแสดง`.
  - Add the strings to the allow file.
- [ ] **Step 8: Write the failing e2e test** `a scheduled article is hidden from the public until its start`.
  - Staff create a published article with `show_from` tomorrow.
  - Anonymous `/articles?q=<title>` shows the no-match text.
  - `/articles/<slug>` shows the article-not-found page.
  - The staff list shows `รอเวลาแสดง`.
- [ ] **Step 9: Run** the vitest and e2e. Expected: PASS.
- [ ] **Step 10: Commit.** Message: `feat: article display window`.

### Task 4: Website problem report

**Files:**
- Create: `supabase/migrations/0039_problem_reports.sql`
- Create: `supabase/tests/problem_reports.test.sql`
- Create: `src/lib/problem-reports/format.ts`, `src/lib/problem-reports/format.test.ts`
- Create: `src/lib/problem-reports/queries.ts`
- Create: `src/app/actions/problem-reports.ts`
- Create: `src/app/(student)/report-problem/page.tsx`
- Create: `src/app/staff/report-problem/page.tsx`
- Create: `src/app/_components/report-problem-form.tsx` (client, shared)
- Create: `src/app/staff/problem-reports/page.tsx`
- Modify:
  - `src/app/staff/layout.tsx` (`ADMIN_ITEMS` gains the reports page; `ACCOUNT_ITEMS` gains the report link)
  - `src/app/staff/_components/staff-nav-icons.tsx` (two icons)
  - `src/app/_components/site-footer.tsx` (link)
  - `src/lib/errors.ts` (Thai messages)
- Test: `tests/e2e/problem-reports.spec.ts`

**Interfaces:**
- SQL:
  - Table `public.problem_reports`, columns exactly as in spec section 5.
    - `message` has the check `char_length(btrim(message, E' \t\r\n')) between 1 and 1000`.
    - `page_url` has the check `page_url is null or (page_url ~ '^/[^/\\]' and char_length(page_url) <= 300)`.
    - `status` is checked `in ('open','done')` and defaults to `'open'`.
    - Index on `(reporter_id, created_at)`.
  - RLS select: `(select public.is_admin()) or reporter_id = (select auth.uid())`. No insert, update or delete
    policies.
  - `submit_problem_report(p_message text, p_page_url text) returns uuid`:
    - Raises `not_authenticated` (42501) when signed out.
    - Raises `invalid_input` for a bad message or URL.
    - Raises `too_many_reports` when the caller has 5 or more reports with `created_at > now() - interval '24 hours'`.
    - Demo callers (`profiles.is_demo`) raise `demo_scope`.
    - Suspended students are not blocked (spec: this may be their only channel). Don't check `account_status`.
    - Inserts the report, then one `notifications` row per profile with role `admin`: type `problem_report`,
      title `มีการแจ้งปัญหาการใช้งาน`, body = the first 120 characters of the message, link `/staff/problem-reports`.
  - `resolve_problem_report(p_id uuid, p_note text) returns boolean`:
    - Admin only; otherwise raises `not_admin`.
    - Unknown id raises `report_not_found`.
    - Already done returns false with no notification.
    - Otherwise sets `status='done'`, `admin_note` (trimmed, null if empty, at most 500), `resolved_by` and
      `resolved_at`, and notifies the reporter when `reporter_id` is not null: type `problem_resolved`, title
      `ปัญหาที่แจ้งได้รับการแก้ไขแล้ว`, body = the note or null, link null. Returns true.
- TS:
  - `safeReportPath(from: string | null | undefined): string | null` in `format.ts` reuses `safeNextPath`'s rules
    but returns null instead of a fallback. It caps the length at 300.
  - `validateReportMessage(text: string): { ok: true; value: string } | { ok: false; error: string }`.
  - `submitProblemReport(prev, formData)` and `resolveProblemReport(prev, formData)` in
    `src/app/actions/problem-reports.ts` follow the `useActionState` shape used in `src/app/actions/notifications.ts`.
  - `listProblemReports(page: number): Promise<{ items: ProblemReport[]; total: number }>` in `queries.ts`:
    open first, newest first, 20 per page.
- Routes:
  - `/report-problem` (student shell) and `/staff/report-problem` (staff shell), split the same way as `/profile`
    and `/staff/profile`. Each redirects the other role, as those pages do.
  - `/staff/problem-reports` calls `requireAdmin`.
- Strings:
  - Footer and nav link: `แจ้งปัญหาการใช้งาน`
  - Admin nav: `แจ้งปัญหา`
  - Success: `ส่งเรื่องแล้ว ขอบคุณที่แจ้ง ผู้ดูแลจะได้รับแจ้งเตือน`
  - `too_many_reports`: `วันนี้แจ้งปัญหาครบ 5 ครั้งแล้ว ลองใหม่พรุ่งนี้`
  - Resolve button: `ทำเครื่องหมายว่าแก้แล้ว`
  - Status labels: `รอดำเนินการ`, `แก้แล้ว`
- Links: the footer link goes to `/report-problem?from=<current path>`. The footer is a server component; if the
  current path isn't available there, link without `from`, and have the form page read `document.referrer`'s path
  on the client through `safeReportPath`.

- [ ] **Step 1: Write the failing pgTAP tests:**
  - A student submits, and every admin gets one `problem_report` notification.
  - A teacher submits successfully.
  - The 6th within 24 h raises `too_many_reports`.
  - A blank or whitespace message raises `invalid_input`.
  - 1000 Thai characters are accepted; 1001 raise `invalid_input`.
  - A `page_url` of `//evil.com` raises `invalid_input`.
  - A student can't select another student's report.
  - Direct insert or update as authenticated is denied.
  - A teacher's resolve raises `not_admin`.
  - An admin's resolve returns true and notifies the reporter once; a second resolve returns false and doesn't
    notify again.
  - A demo caller raises `demo_scope`.
- [ ] **Step 2: Run** the db reset and `npx supabase test db`. Expected: FAIL.
- [ ] **Step 3: Write migration 0039.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Write the failing vitests** for `safeReportPath`:
  - `/rewards?q=1` passes;
  - `//evil.com`, `https://evil.com/x`, `/\evil` and a tab or newline give null;
  - a 301-character path gives null.
  Then for `validateReportMessage`:
  - whitespace-only fails;
  - 1000 Thai characters pass;
  - 1001 fail.
- [ ] **Step 6: Run** `npx vitest run src/lib/problem-reports/format.test.ts`. Expected: FAIL.
- [ ] **Step 7: Implement** `format.ts`, `queries.ts`, the actions, the shared form, the three pages, the nav and
  footer links, the icons, the error messages and the allow-file strings.
- [ ] **Step 8: Write the failing e2e test** `problem-reports.spec.ts` › `a student reports, the admin resolves,
  the student is notified`.
  - The student opens `/report-problem?from=/rewards` and fills the message.
  - The page link shows `/rewards`. The student sends and sees the success text.
  - The admin opens `/staff/problem-reports` and sees the message with `รอดำเนินการ`.
  - The admin resolves it with a note.
  - The student's `/notifications` shows `ปัญหาที่แจ้งได้รับการแก้ไขแล้ว` with the note.
  - A teacher opening `/staff/problem-reports` is redirected.
  - The footer link `แจ้งปัญหาการใช้งาน` is a 44 px target on mobile-chrome.
- [ ] **Step 9: Run** the vitest, `npx playwright test --project=chromium --project=mobile-chrome tests/e2e/problem-reports.spec.ts`
  and check-scope. Expected: PASS.
- [ ] **Step 10: Commit.** Message: `feat: website problem reports`.

### Task 5: Order numbers `ORD-YYYYMMDD-NNNN`

**Files:**
- Create: `supabase/migrations/0040_order_numbers.sql`
- Create: `supabase/tests/order_numbers.test.sql`
- Modify:
  - `src/lib/orders/format.ts` and its test
  - `src/lib/orders/list-config.ts` (search)
  - `src/lib/orders/queries.ts` (select `order_no`)
  - `src/app/(student)/orders/page.tsx:78`
  - `src/app/(student)/orders/[id]/page.tsx:51`
  - `src/app/staff/orders/page.tsx:85-90`
  - `src/lib/pdf/receipt-data.ts:12`
- Test: `tests/e2e/db-races.spec.ts`, `tests/e2e/student-lists.spec.ts` (the `/orders` search test), `tests/e2e/orders*.spec.ts` where they assert the 8-hex number

**Interfaces:**
- SQL:
  - Table `public.order_day_counters (day date primary key, last_no int not null)`, with RLS enabled, no policies
    and all grants revoked.
  - Add `public.next_order_no(p_at timestamptz) returns text` (security definer, revoked from public, anon and
    authenticated; called only inside `checkout`).
    - It takes `day := (p_at at time zone 'Asia/Bangkok')::date`.
    - It upserts the counter (`on conflict (day) do update set last_no = order_day_counters.last_no + 1
      returning last_no`).
    - It returns `'ORD-' || to_char(day,'YYYYMMDD') || '-' || lpad(n::text, 4, '0')`.
  - Add `orders.order_no text`.
  - Backfill with `row_number() over (partition by (created_at at time zone 'Asia/Bangkok')::date order by created_at, id)`.
  - Seed the counters with each day's max.
  - Then `alter column order_no set not null` and add `unique`.
  - `create or replace function public.checkout()`, copied from the latest definition (0016), with
    `order_no` = `public.next_order_no(now())` in the `insert into public.orders`.
  - Recreate the views `my_order_list` and `staff_order_list` (0034) with `order_no` added, keeping their
    `security_invoker` and grants.
  - Grep the migrations for notification texts that print `left(id::text, 8)` or `upper(substr(...))`; if any
    exist, switch them to `order_no` in a `create or replace` of that function.
- TS:
  - `orderNumber(order: { order_no: string }): string` returns `order_no`. Update every caller to pass the row.
  - `orderSearchFilter(q)` and `staffOrderSearchFilter(q)` add `order_no.ilike.<pattern>` and keep the
    `orderIdRange` part.

- [ ] **Step 1: Write the failing pgTAP tests:**
  - `next_order_no('2026-11-25 10:00+07')` twice gives `ORD-20261125-0001` then `-0002`.
  - `2026-11-25 16:59:59+00` gives `ORD-20261125-…` and `2026-11-25 17:00:00+00` gives `ORD-20261126-0001`.
  - Checkout sets `order_no` matching `^ORD-\d{8}-\d{4,}$`.
  - Backfilled orders are unique and not null.
  - authenticated can't execute `next_order_no` and can't select `order_day_counters`.
  - Both views expose `order_no`.
- [ ] **Step 2: Run** the db reset and `npx supabase test db`. Expected: FAIL.
- [ ] **Step 3: Write migration 0040.**
- [ ] **Step 4: Run.** Expected: PASS, and every older test still passes, including `orders.test.sql` and
  `phase2_hardening.test.sql`.
- [ ] **Step 5: Write the failing vitests:**
  - `orderNumber({ order_no: "ORD-20261125-0001" })` returns it.
  - `orderSearchFilter("0001")` contains `order_no.ilike.`.
  - `orderSearchFilter("a1b2")` still contains the id range.
- [ ] **Step 6: Run** `npx vitest run src/lib/orders`. Expected: FAIL.
- [ ] **Step 7: Implement** the TS changes and update the call sites.
- [ ] **Step 8: Update the e2e tests:**
  - `db-races.spec.ts`: case (b) or a new case. Two concurrent checkouts by different students give two
    different `order_no` values.
  - `student-lists.spec.ts` `/orders`:
    - searching the full `order_no` finds one row;
    - the row shows `ORD-`;
    - the old 8-hex search still finds the order.
  - Fix any spec asserting `id.slice(0, 8).toUpperCase()`.
- [ ] **Step 9: Run** `npx playwright test --project=chromium tests/e2e/db-races.spec.ts tests/e2e/student-lists.spec.ts`
  and `npm test`. Expected: PASS.
- [ ] **Step 10: Commit.** Message: `feat: ORD-YYYYMMDD-NNNN order numbers`.

### Task 6: Full gate and docs

**Files:**
- Modify: `docs/dev-notes.md`. Add a short section listing the migrations 0037–0040 and the new admin page.

- [ ] **Step 1:** Run the full gate in order:
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

  Expected: everything passes, 0 e2e failures, lint 0 errors, and build route markers unchanged apart from the
  new routes.
- [ ] **Step 2: Commit.** Checked on 2026-11-25: nothing inserts into `orders` directly. The e2e helpers use
  `rpc("checkout")`, and `scripts/demo` creates no orders, so `order_no` not null needs no seed change. Message: `docs: round 6 notes`.
