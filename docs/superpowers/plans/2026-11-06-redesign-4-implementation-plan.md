# Redesign 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** This round adds four groups of features:
- Search, sort, filter and pagination on every student and staff list.
- Notification delete, with a cap of 100 notifications per student.
- Staff chrome: centre nav on public pages, a collapsible sidebar, a greeting header and two charts.
- Article categories, per-type cover fallbacks, page-shaped skeletons and Thai dd/mm/BE date inputs.
- A student account management area (reset password, suspend, rename, adjust points, delete).

**Architecture:**
- **List framework:** each list declares a `ListConfig` (sort keys, filters, views). `parseListParams(config, sp)` and `listHref(...)` are generic over it, and `ListToolbar` renders layout B from it.
- **Sorting:** lists that can grow sort and page in Postgres. Computed sort keys come from `security_invoker` views (0034). `/cart` and the weigh-station list sort in the app.
- **Accounts:** account rules live in `security definer` functions (0036). Auth-side work (ban, password, delete user) runs in one server-action file through the admin client. The DAL enforces suspension and the forced password change.

**Tech Stack:**
- Next.js 16.4.2 App Router (Cache Components), React 19, Tailwind 4, recharts (already installed).
- Supabase (Postgres 17, Auth, Storage) with pgTAP.
- Tests: Vitest (node env, `renderToStaticMarkup` + `createElement`) and Playwright (chromium + mobile-chrome).

**Spec:** `docs/DESIGN-4.md`. Read it with this plan. Its §-numbers are cited throughout, and its §1.3 is the only source of new UI copy.

## Global Constraints

- **Git:**
  - Branch `redesign-4`. Stage explicit paths only. Never `git commit -a`, `git add -A` or `git add .`. Run `git diff --cached --stat` before every commit.
  - Never stage `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`, `docs/REDESIGN-4-REQUEST.md`, `src/app/_components/home/hero.tsx`, `.agents/`, `.claude/` or `skills-lock.json`.
  - Commit messages are `feat: …`, `fix: …` or `docs: …` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never merge or push.
- **Dependencies:** no new dependencies. No `npm --force` or `--legacy-peer-deps`.
- **Migrations:** never edit existing files in `supabase/migrations/` (0001–0031) or `supabase/tests/`. Add new files only (0032–0036).
- **Forbidden paths:** `src/proxy.ts`, `src/app/api/**` and `scripts/**` stay untouched. `src/lib/supabase/admin.ts` may be imported only by `src/app/actions/accounts.ts`.
- **UI copy:** changes only as listed in DESIGN-4 §1.3. Existing `data-testid` attributes and form field names stay.
- **Chrome:** `/staff/**` keeps its own chrome. `/` and `/articles` must stay ◐ in `npm run build`.
- **New database functions:**
  - `security definer`, `set search_path = ''`, `revoke execute … from public, anon`, then grant to `authenticated`.
  - New views are `with (security_invoker = true)`.
- **Lists:**
  - Page size is 12. Every DB sort ends with `.order("id", { ascending })`, with nulls last.
  - Text search uses `toIlikePattern` and `quoteOrValue`.
- **Full gate before every commit (HANDOFF §9):**
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
- **Running the gate:** run long commands in the background. Kill any stale `next dev` on :3000 before e2e.
- **Next APIs:** before using one, read the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md rule).
- **End of each phase (Tasks 6, 11, 15, 18):** run a whole-phase review, then stop for the owner's "ตรงใจ".

## Review Focus

1. **Stale or hand-edited URLs** (`sort=old` from round 3, `sort=price` on a page without price, `dir=up`, `type=xyz`, `status=` empty, `page=999`). Expected: the defaults or the last page, never a 500.
   - Test: Task 2 Step 1 (`parseListParams` cases) and Task 2 Step 8 e2e (`/articles?sort=old` still lists oldest first).
2. **Deleting a notification while the bell shows it unread.** Expected: the bell count drops without a reload.
   - Test: Task 3 Step 7 e2e (unread count 2 → delete one → bell badge "1").
3. **A suspended student with an open tab.** Expected: the next navigation lands on `/login` with the suspended message, and the student cannot sign back in.
   - Test: Task 17 Step 9 e2e (second browser context).
4. **Typing a date that does not exist or uses the wrong era** (`31/04/2569`, `29/02/2568`, `06/11/2026`). Expected: the hidden value is empty, the Thai error shows, and the form does not submit an invalid date.
   - Test: Task 14 Step 1 (`parseThaiDate`) and Task 14 Step 7 e2e (report form with `31/04/2569`).
5. **The demo admin account acting on a real student.** Expected: no command panel, and the database refuses with `demo_scope`.
   - Test: Task 16 Step 1 pgTAP and Task 17 Step 9 e2e.

---

## Phase 1: student pages

### Task 1: Migrations 0032–0034, pgTAP, scope tool

**Files:**
- Create:
  - `supabase/migrations/0032_notifications_manage.sql`
  - `supabase/migrations/0033_article_category.sql`
  - `supabase/migrations/0034_list_views.sql`
- Create:
  - `supabase/tests/notifications_manage.test.sql`
  - `supabase/tests/article_category.test.sql`
  - `supabase/tests/list_views.test.sql`
- Modify: `tests/redesign/check-scope.mjs`
- Create:
  - `tests/redesign/ui-strings-4.allow.txt`
  - `tests/redesign/ui-strings-4.removed.txt` (header comment only; later tasks append)

**Interfaces:**
- Produces, SQL (DESIGN-4 §7.1–7.3):
  - `notifications`: delete grant + policy `notifications_delete_own`, index `notifications_user_created_idx (user_id, created_at desc, id desc)`
  - trigger `notifications_cap` → `public.notifications_cap_fn()` keeps the newest 100 for students
  - `articles.category text not null default 'knowledge'` (constraint `articles_category_check`)
  - view `public.my_submission_list (id, student_id, activity_id, activity_title, activity_type, activity_cover_path, status, status_rank int, points int, grams bigint, trees bigint, reject_reason, created_at)`
    - `points` = sum of `ledger_entries.points` where `kind='earn'` and `ref_submission_id = id`, null when none
    - `grams` = sum of `submission_items.quantity` when the type is `waste`, else null
    - `trees` = the same sum when the type is `trees`, else null
  - view `public.my_order_list (id, student_id, status, total_points, created_at, expires_at, ready_at, item_names text)`
  - view `public.staff_activity_list` (all `activities` columns + `participant_count bigint`)
  - view `public.staff_order_list (id, student_id, status, status_group text, total_points, created_at, expires_at, ready_at, buyer_name text, buyer_full_name text, buyer_display_name text)`
- Produces, scope tool:
  - reads `ui-strings-4.allow.txt` / `ui-strings-4.removed.txt` (same `text:`/`aria:` format)
  - allows new files under `src/app/auth/signout/` and `src/app/(auth)/change-password/`
  - keeps `src/proxy.ts`, `src/app/api/`, `scripts/` forbidden
  - fails if any file under `src/` imports `@/lib/supabase/admin`, except:
    - `src/app/actions/accounts.ts`
    - `src/app/api/cron/cleanup-orphans/route.ts`
    - `src/app/api/cron/cleanup-orphans/route.test.ts`
    - `src/lib/supabase/server.test.ts`

- [ ] **Step 1: Write the failing pgTAP files**

  `notifications_manage.test.sql`, `plan(9)`. Ids follow the `...5b11` pattern.
  - A student deletes their own notification: 1 row gone.
  - Deleting another user's row affects 0 rows.
  - `anon` delete throws `42501`.
  - After inserting 101 notifications for one student: count = 100, and the oldest `created_at` is gone.
  - A teacher with 101 keeps 101.
  - The trigger exists.
  - The index exists.
  - Deleting a read row by id as owner works with RLS on.
  - Inserting the 101st via `public.notify(...)` (the path real code uses) also caps.

  `article_category.test.sql`, `plan(4)`:
  - The column exists.
  - The default is `'knowledge'`.
  - `'announcement'` is accepted.
  - `'news'` fails with `23514`.

  `list_views.test.sql`, `plan(12)`:
  - Each view has `security_invoker` on (`reloptions` contains `security_invoker=true`).
  - Student A sees only their own rows in `my_submission_list` and `my_order_list`.
  - `points` = the earn sum for an approved submission and null for a pending one.
  - `grams` = 1500 for a waste submission with items 1000 + 500, and null for trees.
  - `status_rank` is 1/2/3.
  - `item_names` contains both reward names.
  - `staff_activity_list.participant_count` = 2 after two joins.
  - `staff_order_list.status_group` is `preparing`/`ready`/`completed`/`closed` across the four states.
  - `buyer_name` falls back from a blank `display_name` to `full_name`.
  - A student selecting `staff_order_list` gets only their own rows. RLS on `orders`: the student sees only their own orders.

- [ ] **Step 2: Run** `npx supabase db reset; npx supabase test db`. Expected: the three new files FAIL and the other files pass.

- [ ] **Step 3: Write the three migrations** per DESIGN-4 §7.1–7.3.
  - The cap function is `security definer`.
  - It deletes the student's rows ordered `created_at desc, id desc offset 100`.
  - Append a comment noting it takes no profile lock (0016 lock order).
  - It ends with a one-time trim: the same delete for every student.

- [ ] **Step 4: Run** `npx supabase db reset; npx supabase test db`. Expected: all pass.

- [ ] **Step 5: Update `check-scope.mjs`** as listed in Interfaces. Then run `node tests/redesign/check-scope.mjs`. Expected: `scope OK`.

- [ ] **Step 6: Run the full gate, then commit** the 9 files: `feat: notifications delete and cap, article category, list views`.

### Task 2: Config-driven list framework, toolbar B, `/articles` and `/activities`

**Files:**
- Modify:
  - `src/app/_components/list/list-params.ts` (+ `list-params.test.ts`)
  - `list-toolbar.tsx`
  - `pagination.tsx`
  - `view-toggle.tsx`
- Create:
  - `src/app/_components/list/sort-direction.tsx`
  - `src/app/_components/list/filter-select.tsx`
  - `src/app/_components/list/client-list.ts` (+ `client-list.test.ts`)
- Create:
  - `src/lib/articles/list-config.ts`
  - `src/lib/activities/list-config.ts`
- Modify:
  - `src/lib/articles/public.ts` (`listPublishedArticlesPage`)
  - `src/lib/activities/queries.ts` (`listActivitiesForStudentPage`)
- Modify:
  - `src/app/(public)/articles/page.tsx`
  - `src/app/(student)/activities/page.tsx`
  - their card/row components
- Modify: `src/lib/articles/format.ts`. Add `ARTICLE_CATEGORIES = ["knowledge","announcement","other"] as const`, `type ArticleCategory`, `ARTICLE_CATEGORY_LABEL_TH`.
- Test:
  - `tests/e2e/articles.spec.ts`
  - `tests/e2e/activities.spec.ts`

**Interfaces:**
- Produces (`list-params.ts`):
  ```ts
  type SortKind = "date" | "number" | "text";
  type SortSpec = { label: string; kind: SortKind; defaultDir: "asc" | "desc" };
  type FilterSpec = { label: string; options: Record<string, string>; defaultValue?: string }; // "all" is implicit
  type ListConfig = { sorts: Record<string, SortSpec>; defaultSort: string; filters?: Record<string, FilterSpec>; views?: boolean; pageSize?: number };
  type ListState = { q: string; sort: string; dir: "asc" | "desc"; filters: Record<string, string>; view: "card" | "list"; page: number };
  function parseListParams(config: ListConfig, sp: RawParams): ListState;
  function listHref(base: string, config: ListConfig, current: ListState, patch: Partial<Omit<ListState, "filters">> & { filters?: Record<string, string> }): string;
  function searchParamsRecord(config: ListConfig, sp: URLSearchParams): RawParams;
  function directionLabel(kind: SortKind, dir: "asc" | "desc"): string; // "ใหม่ → เก่า" | "เก่า → ใหม่" | "มาก → น้อย" | "น้อย → มาก" | "ก → ฮ" | "ฮ → ก"
  const PAGE_SIZE = 12; const Q_MAX = 100;
  ```
- Produces (components):
  - `<ListToolbar base config placeholder />`
  - `<Pagination base config state total />`
  - `<ViewToggle base config state />`
- Produces (`client-list.ts`):
  - `sortRows<T>(rows: T[], key: (r: T) => string | number | null, kind: SortKind, dir): T[]`. Text sorts use `Intl.Collator("th")`. Nulls go last in both directions. Ties are stable.
  - `paginateRows<T>(rows: T[], page: number, size = 12): { items: T[]; page: number; lastPage: number }`. A page past the end clamps to the last page.
- Produces:
  - `ARTICLE_LIST_CONFIG`: sorts `date`↓, `name`↑, `category`↑; filter `category`.
  - `ACTIVITY_LIST_CONFIG`: sorts `date`↓, `name`↑; filters `joined` (`yes`/`no`) and `type` (`waste`/`trees`/`fixed`).
  - `listPublishedArticlesPage(state: Pick<ListState,"q"|"sort"|"dir"|"filters"|"page">)`. It keeps `'use cache'` and `cacheTag(ARTICLES_TAG)`, and its return adds `category`.
  - `listActivitiesForStudentPage(userId, state)`.

- [ ] **Step 1: Write failing unit tests** (`list-params.test.ts`, `client-list.test.ts`), using a test config with sorts `date`(date,desc), `price`(number,asc), `name`(text,asc), a filter `type` {a,b}, and `views: true`:
  - `parseListParams(cfg, {})` → `{ q:"", sort:"date", dir:"desc", filters:{type:"all"}, view:"card", page:1 }`
  - `{ sort:"old" }` → `sort:"date", dir:"asc"` · `{ sort:"new" }` → `date`/`desc`
  - `{ sort:"price" }` → `dir:"asc"` (default dir of that key) · `{ sort:"price", dir:"desc" }` → `desc`
  - `{ sort:"xyz", dir:"up", type:"zzz", view:"grid", page:"-3" }` → the defaults
  - a filter with `defaultValue:"open"` → missing means `open`, `status=all` means `all`
  - `listHref("/x", cfg, state, { filters:{ type:"a" } })` resets the page to 1 and gives `/x?type=a`. The default sort/dir/filter are omitted from the URL.
  - `listHref` with `{ view:"list" }` keeps `page`
  - `directionLabel("text","asc") === "ก → ฮ"` · `directionLabel("number","desc") === "มาก → น้อย"` · `directionLabel("date","desc") === "ใหม่ → เก่า"`
  - `sortRows` on names `["ฮา","กระดาษ","ไก่","เกม", null]` asc → `["กระดาษ","เกม","ไก่","ฮา", null]`; desc → `["ฮา","ไก่","เกม","กระดาษ", null]`
  - `paginateRows(25 rows, 9)` → `page:3, lastPage:3, items.length:1`
  - Move the round-3 tests to the new signatures. Keep the cases for q trimming, q length, junk pages and encoding.

- [ ] **Step 2: Run** `npx vitest run src/app/_components/list`. Expected: FAIL.

- [ ] **Step 3: Implement** `list-params.ts` and `client-list.ts`.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Rebuild the toolbar as layout B** (DESIGN-4 §2.3):
  - Row 1: search + `ViewToggle` (when `config.views`).
  - Row 2: "เรียงตาม" + a select of `config.sorts` labels, `SortDirection` (a `<Link>` to the other dir, text `directionLabel(kind, dir)`, `aria-label` = the label of the dir it switches to), then one `FilterSelect` per filter (label + select; first option "ทั้งหมด" = `all`).
  - Select changes call `router.replace(listHref(...), { scroll:false })`.
  - No-JS fallback: a GET form with hidden inputs for the non-default state and the sr-only submit button.
  - Read `useSearchParams` inside the component's own `<Suspense>`, as before.

- [ ] **Step 6: Wire `/articles` and `/activities`.**
  - Query: `.order(column, { ascending, nullsFirst:false }).order("id", { ascending })`.
    - Articles: column map `date→created_at`, `name→title`, `category→category`; filter `.eq("category", v)`.
    - Activities: `date→created_at`, `name→title`.
    - `joined=yes` → `.in("id", joinedIds)` (empty → total 0). `joined=no` → `.eq("status","open")` plus `.not("id","in",(...))` when non-empty.
    - `type` → `.eq("type", v)`.
  - Article cards show a `Badge` with `ARTICLE_CATEGORY_LABEL_TH[category]` (the badge component already exists).

- [ ] **Step 7: Update the e2e specs.** Old sort-select tests move to the new controls. Add these e2e tests:
  - `/articles?sort=old` lists the oldest first.
  - Sorting by name asc/desc gives ก → ฮ order for three seeded titles "ก-…", "ข-…", "ฮ-…".
  - The category filter shows only an `announcement` article (seed it via the admin client).
  - `/activities` filters `joined=yes`/`no` and `type=trees`.
  - At 360px, `document.documentElement.scrollWidth <= 360`.

- [ ] **Step 8: Run** `npx playwright test tests/e2e/articles.spec.ts tests/e2e/activities.spec.ts`. Expected: PASS.

- [ ] **Step 9: Run the full gate, then commit.** Append the new copy (§1.3 toolbar row) to `ui-strings-4.allow.txt` and the removed "เรียง" / select options to `ui-strings-4.removed.txt`. Message: `feat: config-driven list toolbar with sort direction and filters`.

### Task 3: `/notifications` and `/staff/notifications`

**Files:**
- Create:
  - `src/lib/notifications/list-config.ts` (`STUDENT_NOTIFICATION_CONFIG`, `STAFF_NOTIFICATION_CONFIG`)
  - `src/lib/notifications/queries.ts` (`listNotificationsPage`)
- Modify:
  - `src/app/_components/account-sections.tsx` (`NotificationsSection` → paginated, config by role)
  - `src/app/(student)/notifications/page.tsx`
  - `src/app/staff/notifications/page.tsx`
- Modify:
  - `src/app/actions/notifications.ts` (add `deleteNotification`, `deleteReadNotifications`)
  - `src/components/NotificationBell.tsx` (refetch on `notifications:changed`)
- Create: `src/app/_components/notification-delete.tsx` (client: delete button, delete-read button + confirm dialog)
- Test: `tests/e2e/notifications.spec.ts`, plus a vitest file for the type-prefix mapping

**Interfaces:**
- Produces:
  - `listNotificationsPage(state: ListState): Promise<{ items: NotificationRow[]; total: number }>`
    - Uses the user's session (RLS). Sorts: `date→created_at`, `name→title`.
    - Filter `type` maps `activity|submission|order` → `.like("type", "<prefix>_%")`.
  - `deleteNotification(id: string): Promise<{ ok: boolean; error?: string }>`. It rejects a non-uuid id.
  - `deleteReadNotifications(): Promise<{ ok: boolean; deleted: number; error?: string }>`
  - `NOTIFICATIONS_CHANGED_EVENT = "notifications:changed"` (exported from `notification-delete.tsx`). The bell listens on `window` and reloads its unread count.

- [ ] **Step 1: Write a failing vitest** `src/lib/notifications/list-config.test.ts`.
  - The student config's `type` options are `{ activity:"กิจกรรม", submission:"ผลที่ส่ง", order:"ออเดอร์" }`.
  - The staff config has only `submission` and `order`.
  - `typePrefix("order") === "order_%"`.
  - `parseListParams(STUDENT_NOTIFICATION_CONFIG, { sort:"price" })` falls back to `date`.
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** the config and the query.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Build the UI.**
  - Toolbar, paginated list, a "ลบ" button per row (`aria-label` "ลบการแจ้งเตือน {title}"), and "ลบที่อ่านแล้วทั้งหมด" with the confirm "ลบการแจ้งเตือนที่อ่านแล้วทั้งหมด?".
  - Students also see the note "ระบบเก็บการแจ้งเตือนล่าสุด 100 รายการ".
  - After an action: `router.refresh()`, then `window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))`.
- [ ] **Step 6: Write e2e tests:**
  - A student with 13 notifications sees 12, and page 2 has 1.
  - Search by title.
  - The type filter `order`.
  - Sorting by name.
  - Delete one → it is gone after reload.
  - Two unread → delete one → bell badge shows 1 without reload.
  - Delete read → only unread remain.
  - The staff page has no "กิจกรรม" option and no 100 note.
- [ ] **Step 7: Run** `npx playwright test tests/e2e/notifications.spec.ts`. Expected: PASS.
- [ ] **Step 8: Run the full gate, then commit.** Update the allowlist. Message: `feat: notification search, sort, filter, pagination and delete`.

### Task 4: `/orders` and `/rewards`

**Files:**
- Create:
  - `src/lib/orders/list-config.ts` (`MY_ORDER_CONFIG`)
  - `src/lib/rewards/list-config.ts` (`REWARD_CONFIG`, `STAFF_REWARD_CONFIG` added in Task 10)
- Modify:
  - `src/lib/orders/queries.ts` (add `listMyOrdersPage`)
  - `src/lib/rewards/queries.ts` (add `listActiveRewardsPage`)
- Modify:
  - `src/app/(student)/orders/page.tsx`
  - `src/app/(student)/rewards/page.tsx` (card + list views; extract `RewardCard`/`RewardRow` into `src/app/(student)/rewards/_components/`)
- Test:
  - `tests/e2e/checkout.spec.ts`, or a new `tests/e2e/student-lists.spec.ts`
  - vitest for the search-term split

**Interfaces:**
- Produces:
  - `listMyOrdersPage(studentId, state): Promise<{ items: OrderSummary[]; total: number }>`
    - Reads `my_order_list`. `q` matches `item_names` ilike OR the order-number range (reuse `orderIdRange` from the staff search).
    - Sort `date→created_at`.
  - `listActiveRewardsPage(state): Promise<{ items: Reward[]; total: number }>`
    - Sorts: `date→created_at`, `price→points_cost`, `stock→stock`, `name→name`. Search on `name`.

- [ ] **Step 1: Write a failing vitest** for any pure helper you extract (for example `orderSearchFilter(q)` returns the `.or()` string with an escaped `item_names` pattern, and with the number branch only when `orderIdRange(q)` is non-null).
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** the two queries.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Build the pages.**
  - Toolbars use placeholders "ค้นหาสินค้าหรือเลขที่ออเดอร์" and "ค้นหารางวัล".
  - `/rewards` gets the view toggle. The list view uses a 96×64 thumbnail.
  - Keep the add-to-cart button, the balance and the cart link exactly as they are.
- [ ] **Step 6: Write e2e tests:**
  - 13 rewards → pagination.
  - Price asc puts the cheapest first.
  - Stock desc.
  - `view=list` renders rows.
  - Order search by reward name and by order number.
- [ ] **Step 7: Run** the e2e specs. Expected: PASS.
- [ ] **Step 8: Run the full gate, then commit:** `feat: search, sort and pagination for orders and rewards`.

### Task 5: `/my-submissions` and `/cart`

**Files:**
- Create:
  - `src/lib/submissions/list-config.ts` (`MY_SUBMISSION_CONFIG`)
  - `src/lib/submissions/queries.ts` (`listMySubmissionsPage`)
  - `src/lib/rewards/cart-summary.ts` (`cartRemainder`) + test
- Modify:
  - `src/app/(student)/my-submissions/page.tsx` (cards/rows with cover link)
  - `src/app/(student)/cart/page.tsx` (toolbar, in-app sort/paginate, remainder line)
- Test:
  - `tests/e2e/cart.spec.ts`
  - `tests/e2e/submit.spec.ts` or `student-lists.spec.ts`

**Interfaces:**
- Consumes: `my_submission_list` (Task 1), `sortRows`/`paginateRows` (Task 2), `CoverFallback` (Task 12; until then, use the existing kraft fallback and swap it in Task 12)
- Produces:
  - `listMySubmissionsPage(state)` → `{ items: MySubmission[]; total }`
    - `MySubmission = { id; activityId; activityTitle; activityType; coverUrl: string|null; status; points: number|null; grams: number|null; trees: number|null; rejectReason: string|null; createdAt }`
    - Sorts: `date→created_at`, `status→status_rank`, `points→points`, `kg→grams`, `name→activity_title`.
  - `cartRemainder(balance: number, total: number): { kind: "left" | "short"; points: number }`
  - `CART_CONFIG`: sorts `date`↓ (`cart_items.created_at`, which `listCartLines` must now return as `addedAt`), `price`↑, `total`↓, `qty`↓, `name`↑. No views.

- [ ] **Step 1: Write failing vitest cases:**
  - `cartRemainder(1200, 900)` → `{ kind:"left", points:300 }`
  - `cartRemainder(500, 900)` → `{ kind:"short", points:400 }`
  - `cartRemainder(900, 900)` → `{ kind:"left", points:0 }`
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** `cartRemainder`.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Build `/my-submissions`** (DESIGN-4 §3.2).
  - Card/list views. The cover `<Link href={`/activities/${activityId}`} aria-label={`ดูกิจกรรม ${activityTitle}`}>` wraps only the image.
  - Keep `data-testid="submission"` on each item.
  - Replace the `limit(50)` with pagination.
- [ ] **Step 6: Build `/cart`** (DESIGN-4 §3.3).
  - Load all lines once, sort and paginate with `client-list`, and compute the totals from all lines.
  - The summary line reads "แต้มที่มี {balance} − แต้มรวม {total} = เหลือ {n} แต้ม", or "ขาดอีก {n} แต้ม" in `text-warn`.
  - Keep the checkout button's existing disabled rule.
- [ ] **Step 7: Write e2e tests:**
  - Sorting by status puts pending first.
  - Clicking the cover goes to `/activities/<id>`.
  - Cart with 13 rewards → page 2.
  - The summary line shows "เหลือ" and, after granting fewer points, "ขาดอีก".
  - 360px has no horizontal scroll.
- [ ] **Step 8: Run** the e2e specs. Expected: PASS.
- [ ] **Step 9: Run the full gate, then commit:** `feat: my-submissions and cart lists with covers and points remainder`.

### Task 6: Phase 1 review

- [ ] **Step 1:** Dispatch a whole-phase reviewer over `git diff 0d35f3f..HEAD` against DESIGN-4 §2–§3 and §7.1–7.3. Fix the findings (TDD), then re-review only the fixed parts.
- [ ] **Step 2:** Run the full gate, then report to the owner in Thai with the counts. Stop until the owner says "ตรงใจ".

---

## Phase 2: staff

### Task 7: Migration 0035 and staff navbar on public pages

**Files:**
- Create:
  - `supabase/migrations/0035_staff_charts.sql`
  - `supabase/tests/staff_charts.test.sql`
- Modify:
  - `src/app/_components/main-nav.tsx` (add `items` prop; export `STAFF_MAIN_NAV_ITEMS`)
  - `src/app/_components/header-account.tsx` (the staff variant gets `MainNav` + bell `/staff/notifications`)
  - `src/app/(student)/_components/student-nav.tsx` (the bottom nav takes items by role)
  - `src/app/(student)/layout.tsx`
- Test:
  - `src/app/_components/header-account.test.ts` (render)
  - `tests/e2e/nav.spec.ts`

**Interfaces:**
- Produces, SQL (DESIGN-4 §7.4):
  - `public.staff_carbon_by_month(p_months int default 6) returns table (month date, carbon_kg numeric)`
  - `public.staff_waste_by_category() returns table (code text, name text, grams bigint)`
  - Both raise `not_staff` (`P0001`, message `not_staff`) for non-staff.
- Produces:
  - `STAFF_MAIN_NAV_ITEMS`:
    - หน้าหลัก `/staff` (match `/staff`)
    - กิจกรรม `/activities`
    - บทความ `/articles`
    - รางวัล `/rewards` (match `/rewards`, `/orders`)
    - อันดับ `/leaderboard`
  - `STAFF_BOTTOM_ITEMS`: หน้าหลัก `/staff`, กิจกรรม, รางวัล, แจ้งเตือน `/staff/notifications`

- [ ] **Step 1: Write failing tests.**
  - pgTAP `plan(8)`:
    - A student or anon call raises.
    - 6 rows, oldest first, with the current Bangkok month last.
    - A month with no earn = 0.
    - An earn at `2026-10-31 17:30Z` (= 1 Nov 00:30 Bangkok) counts in November.
    - `p_months` 0 → clamped to 1, 99 → 24 rows.
    - `staff_waste_by_category` returns 4 rows with zeros on an empty DB, and counts only approved waste.
  - vitest: `HeaderAccountView` with a teacher user renders `aria-label="เมนูหลัก"` with exactly the 5 staff labels, the first with href `/staff`, and no "ตะกร้า".
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the migration and the nav changes.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Write e2e tests:**
  - A teacher at `/activities` (desktop) sees the centre nav, and "หน้าหลัก" goes to `/staff`.
  - On mobile-chrome, the teacher's bottom nav "หน้าหลัก" goes to `/staff`, and "แจ้งเตือน" goes to `/staff/notifications`.
  - The student nav is unchanged.
- [ ] **Step 6: Run** the e2e tests. Expected: PASS.
- [ ] **Step 7: Run the full gate, then commit:** `feat: staff centre nav on public pages and chart functions`.

### Task 8: Collapsible sidebar and the `/staff` home

**Files:**
- Create: `src/app/staff/_components/staff-nav-icons.tsx`
- Modify:
  - `src/app/staff/_components/staff-nav.tsx`
  - `src/app/staff/layout.tsx` (read the cookie in `<Suspense>`; add the "บัญชีนักเรียน" item, href `/staff/students`, as a link only; the page comes in Task 17)
- Modify: `src/lib/greeting.ts` (+ test) — add `"สวัสดีตอนดึก"`
- Modify:
  - `src/app/staff/page.tsx` (header, charts; remove `MENU`/`ADMIN_MENU`)
  - `src/lib/admin/queries.ts` (add `getStaffCharts`)
- Create: `src/app/staff/_components/carbon-by-month.tsx` (client recharts, pattern of `WasteByCategory`)
- Test:
  - `src/lib/greeting.test.ts`
  - `tests/e2e/admin.spec.ts` or a new `tests/e2e/staff-shell.spec.ts`

**Interfaces:**
- Produces:
  - `greetingFor(date)` adds the boundary: hour 17–18 → เย็น, hour 19–23 and 0–4 → ดึก.
  - `SIDEBAR_COOKIE = "staff-sidebar"`, with value `"collapsed"`.
  - `<StaffSidebar collapsed={boolean}>`: a client toggle that writes `document.cookie = "staff-sidebar=collapsed; path=/staff; max-age=31536000; samesite=lax"` (or deletes it), and sets `aria-expanded` on the button.
  - `getStaffCharts(): Promise<{ months: { month: string; carbonKg: number }[]; waste: WasteDatum[] }>`

- [ ] **Step 1: Write failing vitest cases** for `greetingFor` at Bangkok 04:59 (ดึก), 05:00 (เช้า), 10:59, 11:00, 12:59, 13:00, 16:59, 17:00 (เย็น), 18:59 (เย็น), 19:00 (ดึก) and 23:59 (ดึก).
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** the greeting change.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Build the sidebar** (DESIGN-4 §4.2).
  - Icons for each item.
  - Collapsed width is `w-16`. Labels become `sr-only` plus `aria-label`, and a CSS tooltip shows on `hover`/`focus-visible`.
  - The section header becomes a rule.
  - The toggle reads "ยุบเมนู"/"กางเมนู".
  - The layout reads the cookie via `cookies()` inside the sidebar's `<Suspense>`. The fallback is expanded.
- [ ] **Step 6: Build the `/staff` home** (DESIGN-4 §4.3).
  - Greeting, `Avatar` at 72px, `Badge` ("ครู"/"ผู้ดูแลระบบ") before the name, and the email.
  - `StaffStats` unchanged.
  - The two charts in their own `<Suspense>`, each with an sr-only table and "ยังไม่มีข้อมูล" when all values are zero.
- [ ] **Step 7: Write e2e tests:**
  - Collapse → reload → still collapsed (`aria-expanded="false"`, the links keep `aria-label`) → expand.
  - With `page.clock` at 19:30 Bangkok, `/staff` shows "สวัสดีตอนดึก".
  - The badge "ครู" precedes the name.
  - `data-testid="waste-chart"` and `data-testid="carbon-chart"` are visible.
  - The old menu hint "อนุมัติหรือปฏิเสธผลที่นักเรียนส่ง" is absent.
- [ ] **Step 8: Run** the e2e tests. Expected: PASS.
- [ ] **Step 9: Run the full gate, then commit.** Move the removed hints into `ui-strings-4.removed.txt`. Message: `feat: collapsible staff sidebar, greeting header and charts`.

### Task 9: `/staff/activities` and `/staff/weigh-station`

**Files:**
- Modify:
  - `src/lib/activities/list-config.ts` (add `STAFF_ACTIVITY_CONFIG`)
  - `src/lib/activities/queries.ts` (add `listActivitiesForStaffPage`; keep `listActivitiesForStaff` while anything still uses it)
  - `src/app/staff/activities/page.tsx`
- Modify:
  - `src/app/actions/weigh-codes.ts` (`SEARCH_LIMIT = 200`, return `joinedAt`)
  - `src/app/staff/weigh-station/_components/weigh-station.tsx`
- Test:
  - `tests/e2e/activities.spec.ts`
  - `tests/e2e/weigh-station.spec.ts`

**Interfaces:**
- Produces:
  - `STAFF_ACTIVITY_CONFIG`:
    - sorts `date`↓ (`created_at`), `participants`↓ (`participant_count`), `name`↑
    - filters `type`, `status` (`draft` ร่าง / `open` เปิดรับ / `closed` ปิดรับ), `code` (`yes` "ใช้รหัสจุดชั่ง" / `no` "ไม่ใช้")
  - `listActivitiesForStaffPage(state): Promise<{ items: StaffActivityRow[]; total }>` reads `staff_activity_list`.
  - `StudentHit` gains `joinedAt: string`.

- [ ] **Step 1: Write a failing vitest** for any extracted helper (for example `staffActivityFilters(filters)` → a list of `[column, op, value]`). Include `code=yes` → `requires_code eq true`.
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** the helper and the query.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Build the pages.**
  - `/staff/activities` rows: a 96×64 cover (or the kraft fallback until Task 12), the existing details, the existing edit/delete buttons, and "ดู" → `/activities/{id}` hidden for `draft`. The `PageHeader` gets "กลับ" → `/staff`.
  - Weigh station: client state `sort` (`joined` asc default | `name` asc) + direction button + `paginateRows` (12). Each row shows "เข้าร่วม {formatBangkok(joinedAt)}". Reset to page 1 on a new search or a new activity.
- [ ] **Step 6: Write e2e tests:**
  - Staff activities: filter `status=draft` and `code=yes`; sort by participants; "ดู" links to `/activities/<id>` and is absent on a draft.
  - Weigh station: 13 joined students → page 2 has 1, and sorting by name puts "ก…" first.
- [ ] **Step 7: Run** the e2e tests. Expected: PASS.
- [ ] **Step 8: Run the full gate, then commit:** `feat: staff activity list filters and weigh-station paging`.

### Task 10: `/staff/orders`, `/staff/rewards`, `/staff/articles`, `/staff/notifications` toolbar

**Files:**
- Modify:
  - `src/lib/orders/list-config.ts` (`STAFF_ORDER_CONFIG`)
  - `src/lib/orders/queries.ts` (`listStaffOrdersPage`)
  - `src/app/staff/orders/page.tsx`
- Modify:
  - `src/lib/rewards/list-config.ts` (`STAFF_REWARD_CONFIG`)
  - `src/lib/rewards/queries.ts` (`listRewardsForStaffPage`)
  - `src/app/staff/rewards/page.tsx`
- Modify:
  - `src/lib/articles/list-config.ts` (`STAFF_ARTICLE_CONFIG`)
  - `src/lib/articles/queries.ts` (`listArticlesForStaffPage`)
  - `src/app/staff/articles/page.tsx`
- Test:
  - `tests/e2e/checkout.spec.ts` / `review.spec.ts` (orders)
  - `tests/e2e/reward-form.spec.ts`
  - `tests/e2e/articles.spec.ts`

**Interfaces:**
- Produces:
  - `STAFF_ORDER_CONFIG`:
    - sorts `date`↑ (`created_at`), `points`↓ (`total_points`), `buyer`↑ (`buyer_name`)
    - filter `status` with `defaultValue: "open"`. Options: `open` รอรับทั้งหมด, `preparing` รอเตรียม, `ready` เตรียมของเสร็จ, `completed` รับแล้ว, `closed` ยกเลิก-หมดอายุ; `all` = ทั้งหมด.
  - `listStaffOrdersPage(state)` reads `staff_order_list`.
    - `open` → `status eq pending_pickup`; the other options → `status_group eq <value>`.
    - Search keeps the existing rules (`buyer_full_name`/`buyer_display_name` ilike, or the number range).
  - `STAFF_REWARD_CONFIG`: sorts `date`↓, `points`↑, `stock`↓, `name`↑; filter `active` (`yes` เปิดการแลก / `no` ปิดการแลก).
  - `STAFF_ARTICLE_CONFIG`: sorts `date`↓, `name`↑; filter `category`.
  - The notifications page already has its toolbar (Task 3). Add only "กลับ" if it is missing.

- [ ] **Step 1: Write failing vitest cases** for `staffOrderFilter(status)`:
  - `open` → `["status","eq","pending_pickup"]`
  - `ready` → `["status_group","eq","ready"]`
  - `all` → `null`
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** `staffOrderFilter` and the three queries.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Build the three pages.**
  - Each gets the toolbar, pagination and "กลับ" → `/staff`.
  - Orders keep `ExpireButton` and `OrderActions` as they are.
  - Articles rows get a 96×64 cover (kraft fallback until Task 12) and a category badge.
- [ ] **Step 6: Write e2e tests:**
  - Orders default shows only pending, oldest first; `status=completed` shows the completed order; sorting by buyer name.
  - Rewards filter `active=no`.
  - Staff articles search plus pagination with 13 articles.
- [ ] **Step 7: Run** the e2e tests. Expected: PASS.
- [ ] **Step 8: Run the full gate, then commit:** `feat: staff orders, rewards and articles lists`.

### Task 11: Phase 2 review

- [ ] **Step 1:** Dispatch a whole-phase reviewer over Tasks 7–10 against DESIGN-4 §4 and §7.4. Fix the findings, then re-review.
- [ ] **Step 2:** Run the full gate, then report in Thai. Stop until "ตรงใจ".

---

## Phase 3

### Task 12: Article category in the staff form and `CoverFallback`

**Files:**
- Modify:
  - `src/lib/articles/format.ts` (`ArticleInput.category`, `validateArticle`)
  - `src/lib/articles/format.test.ts`
  - `src/app/actions/articles.ts`
  - `src/app/staff/articles/_components/article-form.tsx`
  - `src/app/(public)/articles/[slug]/page.tsx`
  - `src/lib/articles/public.ts` (`getPublishedArticle` returns `category`)
- Create:
  - `src/app/_components/cover-fallback.tsx`
  - `src/app/_components/cover-fallback.test.ts`
- Modify:
  - `src/app/globals.css` (tokens `--cover-{waste,trees,fixed,article}` and `-ink`, both themes, plus `@theme` mappings)
- Modify, to use `CoverFallback` in place of the kraft + leaf:
  - `/activities` card and row
  - `/articles` card and row
  - `src/app/_components/home/activities-section.tsx`
  - `/my-submissions`
  - `/staff/activities`
  - `/staff/articles`
- Test:
  - `tests/e2e/articles.spec.ts`
  - `tests/e2e/home.spec.ts`

**Interfaces:**
- Produces:
  - `<CoverFallback kind: "waste" | "trees" | "fixed" | "article"; className?: string />`
    - renders `<div data-cover-fallback={kind} aria-hidden="true">` with an inline SVG (trash / tree / star / document)
  - `coverKindForActivity(type: string): "waste" | "trees" | "fixed"` (unknown → `waste`)

- [ ] **Step 1: Write failing vitest cases:**
  - `validateArticle` with `category: "news"` → the field error is set; `"announcement"` → ok.
  - `coverKindForActivity("trees") === "trees"`, `("x") === "waste"`.
  - The render of `CoverFallback kind="fixed"` contains `data-cover-fallback="fixed"` and `aria-hidden="true"`.
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** the validation, the action, the form select "ประเภทบทความ" and the component.
  - Check contrast: the icon against its background must be ≥ 3:1 in both themes. Record the ratios in a CSS comment.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Write e2e tests:**
  - Staff create an article as "ประกาศ" → `/articles?category=announcement` lists it with the badge → the detail page shows "ประกาศ".
  - An activity of type trees without a cover shows `[data-cover-fallback="trees"]` on `/activities` and on `/`.
- [ ] **Step 6: Run** the e2e tests. Expected: PASS.
- [ ] **Step 7: Run the full gate, then commit:** `feat: article categories and per-type cover fallbacks`.

### Task 13: Page-shaped skeletons

**Files:**
- Create:
  - `src/app/_components/skeletons.tsx`
  - `src/app/_components/skeletons.test.ts`
- Modify: every `page.tsx` listed in DESIGN-4 §5.3 (replace its `PageSkeleton` fallback; wrap any data section that has no `<Suspense>`)
- Test: `tests/e2e/skeletons.spec.ts` (new)

**Interfaces:**
- Produces:
  - `ListSkeleton({ view = "card", rows = 6, toolbar = true })`
  - `DetailSkeleton()`
  - `FormSkeleton({ fields = 4 })`
  - `DashboardSkeleton()`
  - `TableSkeleton({ rows = 8 })`
  - All render `aria-busy="true"`, an sr-only "กำลังโหลด...", `data-skeleton="<name>"` and `motion-safe:animate-pulse`.
  - `PageSkeleton` stays exported, for the `StaffGate` fallback.

- [ ] **Step 1: Write failing render tests:**
  - Each skeleton has `aria-busy="true"`, the text "กำลังโหลด...", the right `data-skeleton`, and `motion-safe:animate-pulse`.
  - `ListSkeleton view="list" rows=3` renders 3 row placeholders.
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** the skeletons, then swap the fallbacks page by page, following the §5.3 map.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Write e2e tests.** Use `page.route` to delay the Supabase REST call for `/rewards`, `/activities/<id>` and `/staff` by 1.5 s. Expected: `[data-skeleton="list"]`, `[data-skeleton="detail"]` and `[data-skeleton="dashboard"]` are visible, then replaced by content.
- [ ] **Step 6: Run** the e2e tests. Expected: PASS.
- [ ] **Step 7: Run the full gate, then commit:** `feat: page-shaped loading skeletons`.

### Task 14: `DateInput`, `DateTimeInput` and CSV dates

**Files:**
- Create:
  - `src/lib/thai-date.ts`
  - `src/lib/thai-date.test.ts`
- Create:
  - `src/components/ui/date-input.tsx`
  - `src/components/ui/date-input.test.ts` (export from `src/components/ui/index.ts`)
- Modify:
  - `src/app/staff/reports/page.tsx` (the `from`/`to` inputs)
  - `src/app/staff/activities/_components/activity-form.tsx` (`starts_at`/`ends_at`)
- Modify:
  - `src/lib/reports/csv-rows.ts`
  - `src/lib/reports/csv-rows.test.ts` (date column → `formatThaiDate`)
- Test:
  - `tests/e2e/reports.spec.ts`
  - `tests/e2e/activities.spec.ts`
  - `tests/e2e/preserved-forms.spec.ts` (it must still pass)

**Interfaces:**
- Produces:
  - `parseThaiDate(text: string): string | null` (`"06/11/2569"` → `"2026-11-06"`)
  - `formatThaiDate(iso: string): string` (`"2026-11-06"` → `"06/11/2569"`; invalid → `""`)
  - `THAI_MONTHS_LONG: readonly string[]`
  - `<DateInput name id? defaultValue? required? min? max? />` posts a hidden `name` = `YYYY-MM-DD`.
  - `<DateTimeInput name id? defaultValue? required? />` posts a hidden `name` = `YYYY-MM-DDTHH:mm`.

- [ ] **Step 1: Write failing vitest cases:**
  - `parseThaiDate("29/02/2567") === "2024-02-29"`, `("29/02/2568") === null`, `("31/04/2569") === null`, `("06/11/2026") === null` (year outside 2400–2700), `("6/11/2569") === "2026-11-06"`, `("") === null`, `("aa/bb/cccc") === null`
  - `formatThaiDate("2033-05-10") === "10/05/2576"`
  - The CSV test now expects `"10/05/2576"` where it had `"2033-05-10"`.
  - `DateInput` render with `defaultValue="2026-11-06"` shows `value="06/11/2569"` and a hidden `value="2026-11-06"`.
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** `thai-date.ts`, the CSV change and the components (DESIGN-4 §5.4).
  - The calendar popover is `role="dialog"` with a `role="grid"` table.
  - Keys: arrows move by day, PageUp/PageDown by month, Enter picks, Esc closes and returns focus to the button.
  - Days outside `min`/`max` get `aria-disabled`.
  - It is reset by `key` when the form resets (the `<Activity>` rule from HANDOFF).
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5:** Grep `src/` for `toLocaleDateString`, `type="date"` and `type="datetime-local"`. Expected: no matches outside comments.
- [ ] **Step 6: Write e2e tests:**
  - Reports: type `01/10/2569` and `31/10/2569` → the CSV link query has `from=2026-10-01`.
  - Pick a day from the calendar with the keyboard.
  - `31/04/2569` → the error "วันที่ไม่ถูกต้อง (วว/ดด/ปปปป พ.ศ.)" and no navigation.
  - Activity form: create with `DateTimeInput` → the edit page shows the same Thai date and time.
- [ ] **Step 7: Run** the e2e tests. Expected: PASS.
- [ ] **Step 8: Run the full gate, then commit:** `feat: Thai dd/mm/BE date inputs and CSV dates`.

### Task 15: Phase 3 review

- [ ] **Step 1:** Dispatch a whole-phase reviewer over Tasks 12–14 against DESIGN-4 §5. Fix the findings, then re-review.
- [ ] **Step 2:** Run the full gate, then report in Thai. Stop until "ตรงใจ".

---

## Phase 4: student accounts

### Task 16: Migration 0036 and enforcement (DAL, sign-out route, change-password, login message)

**Files:**
- Create:
  - `supabase/migrations/0036_student_accounts.sql`
  - `supabase/tests/student_accounts.test.sql`
- Modify:
  - `src/lib/auth/dal.ts` (`CurrentUser.suspendedUntil`, `mustChangePassword`; `requireUser` redirects; `assertActiveUser`)
  - `src/lib/auth/messages.ts` (map `user_banned` and the `suspended` query)
- Create:
  - `src/app/auth/signout/route.ts`
  - `src/app/(auth)/change-password/page.tsx`
  - `src/app/(auth)/change-password/change-password-form.tsx`
- Modify: `src/lib/auth/actions.ts` (add `changeTemporaryPassword`)
- Modify: `src/app/(auth)/login/page.tsx` (show `?error=suspended`)
- Test:
  - `src/lib/auth/dal.test.ts` (or extend the existing test), for the redirect decisions as a pure function
  - `tests/e2e/accounts.spec.ts` (new; the forced-change flow is tested in Task 17)

**Interfaces:**
- Produces, SQL (DESIGN-4 §7.5): tables `account_status`, `account_events`, and these functions:
  - `staff_list_students(p_q text, p_sort text, p_dir text, p_status text, p_limit int, p_offset int) returns table (id uuid, full_name text, display_name text, email text, avatar_path text, created_at timestamptz, points bigint, carbon_kg numeric, suspended_until timestamptz, must_change_password boolean, is_demo boolean, total bigint)`
    - sort ∈ `date|name|points`, dir ∈ `asc|desc`, status ∈ `all|active|suspended|must_change`
  - `staff_get_student(p_student uuid)`: the same columns without `total`, plus `suspend_reason text`, `suspended_by_name text`
  - `staff_list_account_events(p_student uuid, p_limit int default 20) returns setof account_events`
  - `staff_begin_password_reset(p_student uuid) returns void`
  - `staff_suspend_student(p_student uuid, p_days int, p_reason text) returns timestamptz` (the new `suspended_until`)
  - `staff_unsuspend_student(p_student uuid) returns void`
  - `admin_set_student_name(p_student uuid, p_full_name text, p_display_name text) returns void`
  - `admin_check_student_delete(p_student uuid) returns text`
  - `admin_record_student_deleted(p_student uuid, p_name text) returns void`
  - `clear_must_change_password() returns void`
  - `leaderboard(p_period, p_now)` recreated from 0027, skipping suspended students
  - Errors (`raise exception '<code>'`): `not_staff`, `not_admin`, `not_student`, `demo_scope`, `self_target`, `invalid_input`
- Produces, TS:
  - `type CurrentUser = { …existing; suspendedUntil: string | null; mustChangePassword: boolean }`
  - `accessDecision(user: { suspendedUntil: string|null; mustChangePassword: boolean } | null, now: Date, pathname: string): "ok" | "signin" | "suspended" | "change_password"`
  - `assertActiveUser(): Promise<CurrentUser>` (throws `Error("must_change_password")` / redirects on suspended)
  - `GET|POST /auth/signout?reason=suspended` → `signOut()` → `303 /login?error=suspended`
  - `changeTemporaryPassword(prev, formData): Promise<{ fieldErrors?; formError? }>`

- [ ] **Step 1: Write the failing pgTAP file** `student_accounts.test.sql`. Cover:
  - Every function × {student, teacher, admin, demo teacher, demo admin} × target {student, demo student, teacher, self} → allowed or the exact error code.
  - Teacher → `admin_set_student_name` = `not_admin`.
  - Demo admin → real student = `demo_scope`.
  - Admin → teacher = `not_student`.
  - `p_reason` `''` / 501 chars = `invalid_input`; `p_days` 0 / 366 = `invalid_input`; `p_days` null → `suspended_until = 'infinity'`.
  - Each command writes one `account_events` row with `actor_name` and `student_name`. A staff update or delete of `account_events` affects 0 rows.
  - A student can select only their own `account_status`.
  - `clear_must_change_password()` clears only the caller's row.
  - `leaderboard('all')` excludes a student suspended until tomorrow, and includes them with `p_now` two days later.
  - `staff_list_students` searches by email, sorts by points desc, filters `suspended`, and returns `total`.
- [ ] **Step 2: Run** `npx supabase db reset; npx supabase test db`. Expected: FAIL.
- [ ] **Step 3: Write the migration.** Then run the tests. Expected: PASS.
- [ ] **Step 4: Write failing vitest cases** for `accessDecision`:
  - `null` → `signin`
  - `suspendedUntil` in the future → `suspended`
  - in the past → `ok`
  - `"infinity"` → `suspended`
  - must change at `/dashboard` → `change_password`
  - must change at `/change-password` → `ok`
- [ ] **Step 5: Run** the vitest. Expected: FAIL.
- [ ] **Step 6: Implement** the DAL changes.
  - Embed `account_status(suspended_until, must_change_password)` in the existing profile select.
  - A suspended user makes `getCurrentUser` return `null`, and `requireUser` redirects to `/auth/signout?reason=suspended`.
  - Then build the route, the change-password page and its action.
    - Validate with the existing password rules, plus "รหัสผ่านไม่ตรงกัน" for a mismatch.
    - Call `updateUser({ password })`, then `rpc("clear_must_change_password")`, then redirect by role.
  - Then the login message.
  - Read `node_modules/next/dist/docs/` on route handlers and on `redirect` from route handlers first.
- [ ] **Step 7: Run** the vitest. Expected: PASS.
- [ ] **Step 8: Write an e2e test.** Set `account_status` through the admin client for a test student → visiting `/dashboard` lands on `/login?error=suspended` with "บัญชีนี้ถูกระงับ ติดต่อครูหรือผู้ดูแล".
- [ ] **Step 9: Run** the e2e test. Expected: PASS.
- [ ] **Step 10: Run the full gate, then commit:** `feat: student account status, events and enforcement`.

### Task 17: `/staff/students` pages and account commands

**Files:**
- Create:
  - `src/lib/accounts/temp-password.ts` + test
  - `src/lib/accounts/list-config.ts`
  - `src/lib/accounts/queries.ts`
  - `src/lib/accounts/validation.ts` + test
- Create: `src/app/actions/accounts.ts`
- Create:
  - `src/app/staff/students/page.tsx`
  - `src/app/staff/students/[id]/page.tsx`
  - `src/app/staff/students/_components/{reset-password-panel,suspend-panel,rename-panel,delete-panel,account-events}.tsx`
- Modify:
  - `src/app/staff/users/[id]/page.tsx` (remove `AdjustForm`; add the link "จัดการบัญชีนักเรียน")
  - move `AdjustForm` usage into `/staff/students/[id]`
- Test:
  - `tests/e2e/accounts.spec.ts`
  - `tests/e2e/admin.spec.ts` (move the adjust tests)

**Interfaces:**
- Consumes: the Task 16 SQL functions, `CurrentUser`, `assertActiveUser`
- Produces:
  - `generateTempPassword(random?: (n: number) => Uint8Array): string`
  - `validateSuspend(input: { duration: "1"|"3"|"7"|"30"|"custom"|"forever"; customDays: string; reason: string }): { ok: true; days: number | null; reason: string } | { ok: false; fieldErrors }`
  - `STUDENT_ACCOUNT_CONFIG`: sorts `date`↓, `name`↑, `points`↓; filter `status` (`active` ปกติ / `suspended` ถูกระงับ / `must_change` ต้องเปลี่ยนรหัสผ่าน)
  - Server actions (each returns `{ ok: true; … } | { ok: false; error: string }`):
    - `resetStudentPassword(studentId): Promise<{ ok: true; password: string } | { ok: false; error: string }>`
    - `suspendStudent(studentId, input)` / `unsuspendStudent(studentId)`
      - `ban_duration` = `"<days*24>h"` | `"876000h"` | `"none"`
      - If the Auth step fails after the DB step: `{ ok: false, error: "บันทึกแล้ว แต่ระบบเข้าสู่ระบบยังไม่อัปเดต กดอีกครั้ง" }`
    - `renameStudent(studentId, { fullName, displayName })`
    - `deleteStudent(studentId, confirmName)`

- [ ] **Step 1: Write failing vitest cases:**
  - `generateTempPassword` with a deterministic source has length 10, uses only the allowed alphabet, contains at least one digit and one letter, and passes `MIN_PASSWORD_LENGTH`.
  - `validateSuspend`:
    - `custom` with `"0"`/`"366"`/`"abc"` → an error; `"365"` → `days: 365`
    - `forever` → `days: null`
    - empty reason → an error; a reason of 501 chars → an error
- [ ] **Step 2: Run** the vitest. Expected: FAIL.
- [ ] **Step 3: Implement** the libs and `src/app/actions/accounts.ts` (DESIGN-4 §6.2).
  - Every action calls `assertActiveUser()` and checks the role.
  - Then the RPC, then `createAdminClient().auth.admin.*`, then `revalidatePath`.
  - Never log the temporary password.
- [ ] **Step 4: Run** the vitest. Expected: PASS.
- [ ] **Step 5: Build the pages** (DESIGN-4 §6.1).
  - Panels are shown by role and `is_demo` scope.
  - The password dialog shows the password once, with copy text.
  - The delete dialog enables "ลบบัญชีถาวร" only when the typed name equals `full_name` exactly (after trim).
  - After a delete: `redirect("/staff/students?deleted=1")`, which shows "ลบบัญชีแล้ว".
- [ ] **Step 6: Write the e2e tests, part 1** (tag `@accounts`):
  - The teacher sees only the reset and suspend panels; the admin sees all five.
  - Reset → read the shown password → sign in as the student in a new context → lands on `/change-password` → set a new password → `/dashboard`. The old temporary password no longer works.
- [ ] **Step 7: Write the e2e tests, part 2:**
  - Suspend 1 day with a reason → the student's open context navigates → `/login?error=suspended` → signing in shows the same message → unsuspend → sign-in works.
  - A suspended student is absent from `/leaderboard`.
- [ ] **Step 8: Write the e2e tests, part 3:**
  - Delete: a wrong name keeps the button disabled; the right name deletes; the event list still shows "delete" with the name.
  - A demo admin (`is_demo` set via the admin client) on a real student sees "บัญชีสาธิตจัดการได้เฉพาะนักเรียนสาธิต".
  - Rename and adjust work for the admin.
  - At 360px, `/staff/students` has no horizontal scroll.
- [ ] **Step 9: Run** `npx playwright test tests/e2e/accounts.spec.ts tests/e2e/admin.spec.ts`. Expected: PASS.
- [ ] **Step 10: Run the full gate, then commit:** `feat: student account management for teachers and admins`.

### Task 18: Final review, polish and close-out notes

- [ ] **Step 1:** Dispatch a whole-branch reviewer (`main...redesign-4`) against all of DESIGN-4. Fix the findings, then re-review.
- [ ] **Step 2:** Run the Impeccable audit/polish on the changed pages. Check:
  - contrast in both themes
  - 44px targets
  - focus order of the toolbar, sidebar and date picker
  - reduced motion
  - no duplicate ids after `<Activity>` navigation
- [ ] **Step 3:** Run the full gate. Fill DESIGN-4 §10:
  - the gate table
  - the build lines for `/` and `/articles` (◐)
  - `use-cache-count`, with its reason
  - the known issues
  - the audit results
- [ ] **Step 4: Commit** `docs/DESIGN-4.md` with the message `docs: redesign 4 complete`. Report to the owner in Thai, including the Cloud steps from DESIGN-4 §11.
