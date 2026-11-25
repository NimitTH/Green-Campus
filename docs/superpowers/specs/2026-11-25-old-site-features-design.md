# Features from the old site (round 6): design

Date: 2026-11-25 · Source: `docs/old-site-inventory.md` section 7 · Status: waiting for owner approval

## Why

Green Campus is the owner's graduation project and will be used for real at their school (the
competition is over). From the old site's feature list we take only what helps students and teachers
day to day. Anything that existed only to score against competition criteria is out.

## Goals

1. **Waste rate card:** a waste activity's page shows every waste group's points and carbon per kg,
   so students know the reward before they join.
2. **Quick time ranges:**
   - Reports page: preset buttons for the from/to dates.
   - Staff dashboard: a range choice for both charts.
3. **Readable order numbers:** `ORD-20261125-0001` everywhere an order number appears, and search by it.
4. **Article display window:** optional start/end date-times. Outside the window the public doesn't
   see the article; staff still do.
5. **Website problem report:** any signed-in user reports a problem with the website. Admins are notified,
   see a list, and mark each report done. The reporter is notified back.

## Non-goals (owner agreed, 2026-11-25)

- Podcast or environmental-law article categories.
- A content report, since article views aren't counted.
- A home page carousel; the round-4 home layout stays.
- A notification to admins for each new member, which would flood them at the start of term.
- Reports about things on campus (bins, places). This form is for website problems only.
- Suspend and member search, dark mode, and the "ready for pickup" status. These already exist.

## Anti-goals

- Existing order numbers or receipts change after their order is created. The new number must be
  stable.
- Two orders get the same number when two students check out at once.
- Problem reports become a spam channel to admins.
- A hidden (scheduled or expired) article leaks through any public path: list, page, home feed,
  search, or the article-not-found check.

## Constraints

- The rules in `AGENTS.md` apply.
- Every database change is a new migration (0037 onward) with pgTAP tests.
- RLS and security-definer functions follow the existing patterns.
- New UI strings go in a new `tests/redesign/ui-strings-6.allow.txt`, which check-scope must load.
- No new dependencies.
- Text and touch targets follow the existing rules:
  - Thai UI copy
  - 44 px targets on phones
  - visible focus
  - Activity-safe skip target

## Approaches

### Order numbers

**Chosen (A1):** store the number on the order.
- Add `orders.order_no text unique not null`, set inside the checkout function from a per-day counter.
- The day is the Asia/Bangkok date.
- Existing orders are backfilled in creation order.

**Rejected (A2):** derive the number when displaying it from the created time and position within
the day. It needs no migration, but:
- every display has to count that day's orders;
- search by number is awkward;
- a number could shift if the order data ever changes.

### Problem reports

**Chosen (B1):** store reports in a table and notify admins through the existing notification bell.
Admins get a list with an open/done status, and the reporter is notified when a report is marked done.

**Rejected (B2):** email to admins. It depends on SMTP limits, has no list or status, and the
reporter never hears back.

Every other feature has one obvious way given the existing code.

## Design

### 1. Waste rate card

- **Where:** the activity detail page (`src/app/(student)/activities/[id]/page.tsx`), for `type = 'waste'` only.
- **What:**
  - A small table: group name, แต้ม/กก., carbon กก. CO₂e/กก.
  - It reads `waste_categories`, which students can already read (the submit page uses it).
  - It sits next to the existing "แต้มและ carbon คิดจากน้ำหนัก..." line.
- **Phones:** at 360 px the table must not scroll sideways (stacked rows are fine).
- **Errors:** if loading the rates fails, keep the existing sentence and show no table. Never show an error box.

### 2. Quick time ranges

**Reports (`/staff/reports`):**
- Add preset links above the existing from/to inputs: `7 วัน`, `30 วัน`, `เดือนนี้`, `12 เดือน`.
- Each link fills `from`/`to` in the URL. Dates are in Bangkok time, and the range ends today.
- The current default stays `bangkokMonthRange`.
- The active preset is marked with `aria-current`.
- The custom inputs still work.

**Staff dashboard (`/staff`):**
- Carbon per month: `6 เดือน` (default) or `12 เดือน`. `staff_carbon_by_month(p_months)` already takes the
  number of months.
- Waste by group:
  - Choices: `30 วัน`, `12 เดือน`, `ทั้งหมด` (default, today's behaviour).
  - `staff_waste_by_category` gets an optional since-date parameter. This is a new migration that
    replaces the function and keeps its current grants.
- The choices are links with search params (`?months=12&waste=30d`), read inside `<Suspense>`.
  Unknown values fall back to the defaults.

### 3. Order numbers `ORD-YYYYMMDD-NNNN`

**Schema:**
- Add `public.order_day_counters (day date primary key, last_no int not null)`. Only the definer functions use it.
  Nobody else gets grants.
- Add `orders.order_no text not null unique`.
- The checkout function or functions set `order_no`:
  - `day` is `(now() at time zone 'Asia/Bangkok')::date`.
  - The counter is incremented with `insert ... on conflict (day) do update set last_no = last_no + 1 returning last_no`.
    The row lock serializes concurrent checkouts.
  - The format is `'ORD-' || to_char(day,'YYYYMMDD') || '-' || lpad(n::text, 4, '0')`. Past 9999 in one day,
    the number simply grows longer.
- Find every function that inserts into `orders` (0014, 0015, 0016 replaced checkout; use the current one).

**Backfill:**
- Number existing orders per Bangkok day by `created_at, id`.
- Set the counters to each day's max.
- Then add the not-null and unique constraints.

**Display:**
- `orderNumber()` in `src/lib/orders/format.ts` returns `order_no`.
- Its callers are:
  - the student orders list and detail pages;
  - the staff orders page;
  - `list-config.ts`;
  - the receipt PDF data.
- Every query that feeds these must select `order_no`.
- Check notification texts written by SQL (`order_created`, `order_ready`, `order_expired`) and switch any
  that print the short id.

**Search:**
- `q` matches `order_no` (case-insensitive substring), so `0001`, `20261125-0001` or the full number all work.
- The old 8-hex prefix match (`orderIdRange`) stays, so numbers someone noted down before the change still find their order.

**Tests:**
- pgTAP: the format, the per-day sequence, the Bangkok date boundary, uniqueness, and the backfill.
- The existing db-races spec, with two concurrent checkouts getting different numbers.

### 4. Article display window

**Schema:**
- Add `articles.show_from timestamptz null` and `articles.show_until timestamptz null`.
- Add the check `show_until is null or show_from is null or show_until > show_from`.

**Rule:**
- The public can see an article when all three hold:
  - `published`;
  - `show_from` is null or `show_from <= now()`;
  - `show_until` is null or `now() < show_until`.
- Put this in one SQL function (for example `public.article_is_visible(articles)`) and use it in:
  - `articles_select_public` (anon);
  - the non-staff branch of `articles_select` (authenticated);
  - any security-definer home feed function that lists articles.
- Every public query in `src/lib/articles/public.ts` and `not-found-check.ts` goes through RLS with the anon
  client. They get the rule from RLS, but check that none bypasses it.

**Caching:**
- Public lists use `cacheLife("minutes")`, so an article appears or disappears within about a minute of its
  time. That is acceptable, and the help text in the editor says so.
- Saving an article still calls `updateTag`.

**Staff editor:**
- Two optional fields: `แสดงตั้งแต่` and `แสดงถึง`.
- They are date-time inputs in Bangkok time. Empty means no limit.
- An end before the start is rejected with a Thai message.

**Staff list:**
- A published article outside its window gets a badge: `รอเวลาแสดง` before the start, `หมดเวลาแสดง` after the end.

**Tests:**
- pgTAP RLS: anon and a student can't see an article before the start or after the end; staff can.
- e2e: a scheduled article isn't on `/articles`, and its page shows the article-not-found page.

### 5. Website problem report

**Schema:** add `public.problem_reports` with these columns:

| Column | Type and rule |
|---|---|
| `id` | uuid primary key |
| `reporter_id` | → profiles, on delete set null |
| `reporter_name` | text, a snapshot |
| `message` | text, 1–1000 chars after trimming |
| `page_url` | text, null allowed, a same-site path, at most 300 chars |
| `status` | `open` or `done` |
| `admin_note` | text, null allowed, at most 500 chars |
| `resolved_by` | null allowed |
| `resolved_at` | null allowed |
| `created_at` | timestamptz |

- There is no direct table write access. Two security-definer functions do the writes:
  - `submit_problem_report(p_message, p_page_url)`:
    - Allowed for any signed-in user.
    - At most 5 reports per user per 24 hours; otherwise it raises `too_many_reports`.
    - Inserts the report and notifies every admin. The notification is type `problem_report`, titled
      `มีการแจ้งปัญหาการใช้งาน`, with a link to `/staff/problem-reports`.
  - `resolve_problem_report(p_id, p_note)`:
    - Admin only.
    - Idempotent: calling it on a report that is already done changes nothing and doesn't notify again.
    - Sets the report to done and notifies the reporter (if they still exist). The notification is type
      `problem_resolved`, titled `ปัญหาที่แจ้งได้รับการแก้ไขแล้ว`, with `admin_note` as its body.
- SELECT: admins see all reports; a reporter sees their own.

**Form (`/report-problem`):**
- Who can open it: any signed-in user. It uses the student shell for students and the staff shell for staff,
  so the route may need a twin under `/staff`. Pick whichever matches how `/profile` and `/staff/profile`
  are split.
- Fields: a textarea for the message and a read-only page link.
- `?from=<path>` pre-fills the page link. Only same-site paths are accepted, through the existing safe-path helper.
- On success it shows a Thai confirmation and the form clears.

**Entry points:**
- A `แจ้งปัญหาการใช้งาน` link in the student-area footer.
- The same link in the staff sidebar account group.
- Both pass the current path as `from`.

**Admin page (`/staff/problem-reports`):**
- Admin only, and in the admin nav group.
- The list shows open reports first, newest first, with paging.
- Each report shows the reporter, the time, the message and the page link.
- "ทำเครื่องหมายว่าแก้แล้ว" has an optional note field.

**Demo and suspended accounts:**
- Follow the existing rule for demo accounts' writes (demo accounts must not notify real admins).
- Suspended students: the owner decided on 2026-11-25 that they do not need to report. The existing sign-in gate signs them out, so they cannot reach the form; nothing extra is built.

**Tests:**
- pgTAP: permissions, the rate limit, notifications to admins and back to the reporter, and idempotent resolve.
- e2e: a student reports, an admin sees the report and resolves it, and the student gets the notification.

## Left to the builder

- Exact component structure and file names, following existing patterns.
- The order of tasks. Suggested order, smallest risk first:
  1. rate card
  2. time ranges
  3. article window
  4. problem reports
  5. order numbers
- Migration numbering and how many migrations to split into.
- The exact Thai wording of help texts, keeping the strings named above.

## Calls I made (owner to check)

- The time-range presets are 7 days, 30 days, this month and 12 months. "This term" was dropped because term
  dates vary by school and aren't stored anywhere.
- At most 5 problem reports per person per day.
- Old 8-character order numbers still work in search.
- ~~Suspended students can still send a problem report.~~ Owner, 2026-11-25: not needed (see section 5).
- Only admins see problem reports. Teachers don't, because website problems are for admins to fix.
