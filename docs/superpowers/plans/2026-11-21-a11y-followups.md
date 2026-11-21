# Accessibility Follow-ups (O1–O6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit items O1, O3/O2 (`/staff/users`), O4, O5 and O6 with small targeted UI edits.

**Architecture:** There are four independent UI edits:
- a server-rendered skip link in the two shells
- label and aria-label copy changes
- an icon prop on `CopyLinkButton`
- touch-target padding

Each is covered by Playwright e2e assertions in existing specs. Nothing touches the database.

**Tech Stack:** Next.js 16 (Cache Components / PPR), React 19, Tailwind, Playwright, vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-a11y-followups-design.md`

## Global Constraints

- Branch `a11y-followups`. Stage explicit paths only; never `git commit -a`, `-am`, `git add -A` or `git add .`.
- Never stage or modify the owner's files: `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`,
  `docs/REDESIGN-4-REQUEST.md`, `src/app/_components/home/hero.tsx`, `.agents/`, `.claude/` and `skills-lock.json`.
- No new dependencies. No new `'use cache'` (the count stays 9). `src/proxy.ts` is unchanged.
- `/`, `/articles` and `/staff` must stay ◐ in `npm run build`.
- No migration or pgTAP change.
- Read the relevant guide in `node_modules/next/dist/docs/` before touching Next.js code (AGENTS.md).
- Do not open or submit Next.js feedback forms.
- The only new visible copy is exactly `ข้ามไปเนื้อหา`.
- The new aria-label patterns are exactly `รายละเอียด {ชื่อ}` (`/staff/users`) and `ดู {ชื่อบทความ}` (`/staff/articles`).
- Strings that are now gone must be listed in `tests/redesign/ui-strings-5.removed.txt`: `ปรับแต้ม / ประวัติ` and the
  `จัดการ ${user.fullName}` template, in whatever form check-scope extracts it.
- New strings go in `tests/redesign/ui-strings-5.allow.txt`.
- Run vitest and Playwright from the uppercase `C:\Users\Mitr\Documents\my-app` path.
- Edit files with Edit/Write, not shell heredocs.

## Review Focus

1. **The skip link after client navigation.** After moving between staff pages via the sidebar (React `<Activity>`
   keeps old pages mounted), activating the link must focus the visible page's content. The target id must not appear
   twice. Pinned in Task 1.
2. **Mouse users never see the skip link.** It must stay invisible until it has keyboard focus, in both themes,
   including the collapsed staff sidebar state. Pinned in Task 1.
3. **Long or Thai names in the aria-label.** A student whose name contains spaces still gets exactly
   `รายละเอียด <full name>`. Pinned in Task 2.
4. **The copy-password failure fallback.** With the clipboard refused, the read-only field still appears with the
   clipboard icon variant. This is the existing behaviour and must not regress. Pinned in Task 3.
5. **44px links must not change the desktop layout.** At 1280px the `/staff` open-activity list and the `/staff/orders`
   rows keep their current height order and do not wrap differently. Pinned in Task 4, with a screenshot saved but not
   compared, as in `dashboard.spec.ts`.

---

### Task 1: Skip link in the staff and student shells (O1)

**Files:**
- Create: `src/app/_components/skip-link.tsx`
- Modify: `src/app/staff/layout.tsx` (header area, and the content wrapper `div.flex.min-w-0.flex-1.flex-col` around
  `<StaffGate>`)
- Modify: `src/app/(student)/layout.tsx` (before `<SiteHeader />`, and a wrapper around `{children}`)
- Modify: `tests/redesign/ui-strings-5.allow.txt` (create it with `ข้ามไปเนื้อหา`)
- Modify: `tests/redesign/check-scope.mjs` (load `ui-strings-5.allow.txt` and `ui-strings-5.removed.txt` in the same
  loop as the round-4 files)
- Test: `tests/e2e/staff-shell.spec.ts` and `tests/e2e/student-lists.spec.ts`

**Interfaces:**
- Produces:
  - `export const MAIN_CONTENT_ID = "main-content"`
  - `export function SkipLink(): JSX.Element`, a server component rendering `<a href="#main-content">ข้ามไปเนื้อหา</a>`,
    visually hidden until `:focus-visible` (`sr-only focus:not-sr-only` plus fixed positioning, accent ring, at least
    44px tall)

**Builder's call, recorded here (differs from the spec's wording).** Pages render their own `<main>` (34 of them), so
the target is a wrapper in each layout, not `<main>`:
- **Staff:** put `id={MAIN_CONTENT_ID}` and `tabIndex={-1}` on the existing content div.
- **Student:** wrap `{children}` in `<div id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">`.

The layouts are server components outside every page, so the id renders once per document even with `<Activity>`.

- [ ] **Step 1: Write the failing e2e tests**
  - In `staff-shell.spec.ts`, test `"skip link is the first tab stop and moves focus to the content"`:
    - Log in as staff and go to `/staff/students`.
    - Press `Tab` once and expect `page.getByRole("link", { name: "ข้ามไปเนื้อหา" })` to be focused and visible.
    - Press `Enter` and expect `page.locator("#main-content")` to be focused (`toBeFocused()`).
    - Press `Tab` and expect focus inside `#main-content`, i.e. `page.locator("#main-content :focus")` has count 1.
  - In the same spec, test `"skip link is hidden for mouse users and unique after navigation"`:
    - Without pressing a key, expect the link's bounding box to be 1×1 or smaller, or the link to be off-screen (sr-only).
    - Click the sidebar links to `/staff/activities`, then `/staff/orders`, then `/staff/students`.
    - Expect `page.locator("#main-content")` to have count 1 after each.
    - Press `Tab`, then `Enter`, and expect `#main-content` to contain the `h1` of `/staff/students`.
  - In `student-lists.spec.ts`, test `"student shell skip link focuses the content"`: the same `Tab` / `Enter` /
    focused check on `/activities`.
- [ ] **Step 2: Run them and verify they fail**
  - Run: `npx playwright test tests/e2e/staff-shell.spec.ts tests/e2e/student-lists.spec.ts -g "skip link" --project=chromium`
  - Expected: FAIL, because there is no link named "ข้ามไปเนื้อหา".
- [ ] **Step 3: Implement `SkipLink` and wire it into both layouts.** It is the first child of each layout's root div.
  Add `ข้ามไปเนื้อหา` to `ui-strings-5.allow.txt` and load the new files in check-scope.
- [ ] **Step 4: Run the tests and verify they pass**
  - Run the Step 2 command again, then again with `--project=mobile-chrome`.
  - Expected: PASS on both projects.
  - Also run `node tests/redesign/check-scope.mjs`. It will flag in-place edits until commit; no "new string not allowed".
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/_components/skip-link.tsx src/app/staff/layout.tsx "src/app/(student)/layout.tsx" tests/redesign/ui-strings-5.allow.txt tests/redesign/check-scope.mjs tests/e2e/staff-shell.spec.ts tests/e2e/student-lists.spec.ts
  git commit -m "feat: skip link in staff and student shells"
  ```

### Task 2: Labels and aria-labels on /staff/users and /staff/articles (O3, O2, O5)

**Files:**
- Modify: `src/app/staff/users/page.tsx:162-163`
  - Visible text: always `รายละเอียด`.
  - `aria-label={\`รายละเอียด ${user.fullName}\`}`.
- Modify: `src/app/staff/articles/page.tsx` (the "ดู" `ButtonLink` near line 100):
  - Add `aria-label={\`ดู ${a.title}\`}`.
  - Keep `min-w-11`.
- Create: `tests/redesign/ui-strings-5.removed.txt` listing the removed `ปรับแต้ม / ประวัติ` and the `จัดการ …` template
  string, exactly as check-scope reports them.
- Modify: `tests/redesign/ui-strings-5.allow.txt` (add the new template strings as check-scope extracts them).
- Test: `tests/e2e/admin.spec.ts` and `tests/e2e/articles.spec.ts`

**Interfaces:**
- Consumes: the `ui-strings-5.*` loading from Task 1.

- [ ] **Step 1: Write the failing e2e tests**
  - In `admin.spec.ts`, test `"users list rows link to details with a matching name"`:
    - As admin on `/staff/users`, a student row has `getByRole("link", { name: \`รายละเอียด ${studentName}\` })`
      with visible text exactly `รายละเอียด`.
    - `getByText("ปรับแต้ม / ประวัติ")` has count 0.
    - Use a seeded student whose full name contains a space (Review Focus 3).
  - In `articles.spec.ts`, test `"staff articles view link names the article"`:
    - On `/staff/articles`, `getByRole("link", { name: \`ดู ${title}\` })` exists for a published seed article.
- [ ] **Step 2: Run them and verify they fail**
  - Run: `npx playwright test tests/e2e/admin.spec.ts tests/e2e/articles.spec.ts -g "matching name|names the article" --project=chromium`
  - Expected: FAIL.
- [ ] **Step 3: Make the two edits.** Run `node tests/redesign/check-scope.mjs`, then put the exact strings it reports
  into `ui-strings-5.removed.txt` (gone) and `ui-strings-5.allow.txt` (new).
- [ ] **Step 4: Run the tests and verify they pass**
  - Run the Step 2 command on both projects.
  - Also run the whole of `admin.spec.ts` and `accounts.spec.ts`; existing tests may click the old label.
  - Expected: all PASS, and check-scope reports no string problems.
- [ ] **Step 5: Commit**
  ```bash
  git add src/app/staff/users/page.tsx src/app/staff/articles/page.tsx tests/redesign/ui-strings-5.allow.txt tests/redesign/ui-strings-5.removed.txt tests/e2e/admin.spec.ts tests/e2e/articles.spec.ts
  git commit -m "fix: users and articles link names match their text"
  ```

### Task 3: Clipboard icon on the copy-password button (O6)

**Files:**
- Modify: `src/components/ui/copy-link-button.tsx`
- Modify: `src/app/staff/students/_components/reset-password-panel.tsx:73` (pass `icon="clipboard"`)
- Test: `tests/e2e/accounts.spec.ts` (the existing reset-password test)

**Interfaces:**
- Produces:
  - `CopyLinkButton({ text?, label?, icon? }: { text?: string; label?: string; icon?: "link" | "clipboard" })`
  - The default `icon` is `"link"`, so the public article and activity pages are unchanged.
  - The clipboard SVG: 24-unit viewBox, stroke 2, round caps, `aria-hidden`, plus `data-icon={icon}` on the `<svg>`.

- [ ] **Step 1: Write the failing assertion.** In the existing reset-password test in `accounts.spec.ts`, after the
  password dialog shows:
  ```ts
  await expect(dialog.getByRole("button", { name: "คัดลอกรหัสผ่าน" }).locator('svg[data-icon="clipboard"]')).toHaveCount(1);
  ```
  In `articles.spec.ts`, add the matching assertion that the article page's "คัดลอกลิงก์" button has
  `svg[data-icon="link"]`.
- [ ] **Step 2: Run it and verify it fails**
  - Run: `npx playwright test tests/e2e/accounts.spec.ts -g "reset" --project=chromium`
  - Expected: FAIL (count 0).
- [ ] **Step 3: Implement the `icon` prop and pass `icon="clipboard"` in `reset-password-panel.tsx`.**
- [ ] **Step 4: Run it and verify it passes**
  - Run the Step 2 command, plus `-g "copy"` in `articles.spec.ts`.
  - Also run the existing clipboard-refused case, if the reset test grants no clipboard permission (Review Focus 4).
  - Expected: PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ui/copy-link-button.tsx src/app/staff/students/_components/reset-password-panel.tsx tests/e2e/accounts.spec.ts tests/e2e/articles.spec.ts
  git commit -m "fix: clipboard icon on the copy-password button"
  ```

### Task 4: 44px touch targets (O4) and full gate

**Files:**
- Modify: `src/app/staff/_components/staff-stats.tsx:77` (the open-activity link): add
  `inline-flex min-h-11 items-center`.
- Modify: the order-number link in the `/staff/orders` rows. The audit measured it at 94×28; locate it in
  `src/app/staff/orders/page.tsx` or its row component. Make it `min-h-11` with inline-flex centring.
- Modify: `src/app/_components/site-header.tsx:13` (the logo link, 28px wide on mobile): add `min-w-11`.
- Modify: `src/app/_components/site-footer.tsx:22`. Pass `className="min-h-11 items-center"` to `LessSourceLink`.
  `LessSourceLink` itself is unchanged.
- Test: `tests/e2e/staff-shell.spec.ts`

- [ ] **Step 1: Write the failing e2e test**
  - In `staff-shell.spec.ts`, test `"remaining links are at least 44px on mobile"`. It runs on mobile-chrome; skip on
    chromium with `test.skip(!isMobile)`.
  - For each of these, expect `boundingBox()` to have `height >= 44`, and `width >= 44` for the logo:
    - the first open-activity link on `/staff`
    - the first order-number link on `/staff/orders`
    - the logo link on `/activities`, as a student
    - the footer LESS link on `/activities`
  - Also save `page.screenshot()` of `/staff` at 1280px to `test-results/` without comparing it (Review Focus 5).
- [ ] **Step 2: Run it and verify it fails**
  - Run: `npx playwright test tests/e2e/staff-shell.spec.ts -g "44px" --project=mobile-chrome`
  - Expected: FAIL on the first undersized link.
- [ ] **Step 3: Apply the four class edits.**
- [ ] **Step 4: Run it and verify it passes**
  - Run the Step 2 command.
  - Expected: PASS.
- [ ] **Step 5: Run the full gate, in the foreground, in this order, once each**
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

  Expected:
  - Everything green; known flake: skeletons.spec on mobile, which must pass when re-run alone.
  - Lint has 0 errors.
  - The build shows `◐ /`, `◐ /articles` and `◐ /staff`.
- [ ] **Step 6: Commit and check scope**
  ```bash
  git add src/app/staff/_components/staff-stats.tsx src/app/_components/site-header.tsx src/app/_components/site-footer.tsx tests/e2e/staff-shell.spec.ts <the orders file>
  git commit -m "fix: 44px targets for the remaining small links"
  node tests/redesign/check-scope.mjs
  ```
  Expected: `scope OK`.
