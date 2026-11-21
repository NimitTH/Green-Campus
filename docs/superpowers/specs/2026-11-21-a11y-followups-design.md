# Accessibility follow-ups (O1–O6): short design

Owner approved 2026-11-21 ("ผ่าน").

## Intent

Close the six owner-review items from the Redesign 4 Impeccable audit
(`.superpowers/sdd/2026-11-06-redesign-4-implementation-plan/task-18-audit.md` §3). The goal is that keyboard, screen-reader
and touch users get the same experience as mouse users. Nothing a mouse user sees should change, except the label in
item 2 and the icon in item 5.

## Goals

1. **O1 skip link.** Add a "ข้ามไปเนื้อหา" link as the first focusable element in the staff shell
   (`src/app/staff/layout.tsx`) and in the student layout (`src/app/(student)/layout.tsx`).
   - It is visually hidden until it gets keyboard focus.
   - Activating it moves focus to the page's `<main>`. `<main>` gets an `id` and `tabIndex={-1}`.
   - The id must be unique per page and must not duplicate after `<Activity>` navigation.
2. **O3 + O2 (/staff/users).** Every row's action link shows "รายละเอียด", with the aria-label "รายละเอียด {ชื่อ}".
   This replaces both "ปรับแต้ม / ประวัติ" and the old "จัดการ {ชื่อ}". The link target is unchanged.
3. **O5.** The "ดู" link on `/staff/articles` gets the aria-label "ดู {ชื่อบทความ}", the same pattern as
   `/staff/activities`.
4. **O6.** The copy-password button (student account reset panel) uses a clipboard icon. The copy-link button for
   articles keeps the link icon. Reuse `CopyLinkButton` with an icon prop or variant; do not fork the component.
5. **O4.** Four links must be at least 44px in the touch dimension on mobile:
   - the open-activity links on `/staff` (`staff-stats.tsx`)
   - the order-number links on `/staff/orders`
   - the mobile logo link
   - the footer source link

## Non-goals

- O2 for the bottom-bar bell and for "ออกรหัส" on the weigh station. Both names start with the visible word, so they
  pass and work with speech input.
- The activity-form checkboxes. Their labels give a 44px row already.
- Any database, migration or pgTAP change.

## Anti-goals

- Visual changes beyond items 2 and 5.
- A skip link that shows for mouse users.
- A new `'use cache'`.
- Losing ◐ on `/`, `/articles` or `/staff`.
- Changing `src/proxy.ts`.

## Constraints

The standing project rules apply:
- Stage explicit paths only.
- Never touch the owner's uncommitted files.
- Add no dependencies.
- Copy changes go through `tests/redesign/check-scope.mjs`. Add the new strings "ข้ามไปเนื้อหา" and the
  "รายละเอียด {ชื่อ}" pattern to a new allowlist. Move the removed "ปรับแต้ม / ประวัติ" and "จัดการ {ชื่อ}" to its
  removed list.
- Run the full gate in the HANDOFF §9 order before merging.

## Approaches

There was one sensible way for each item: a small, targeted edit in the existing component, verified by e2e and axe.
Other options were dropped:
- A global skip-link component in the root layout: rejected, because the public pages have no long nav before content,
  and the root layout must stay static for PPR.
- Leaving O3's label and only fixing the aria-label: rejected, because the visible label is stale since points
  adjustment moved to `/staff/students/[id]`.

## Left to the builder

- The exact hidden-until-focus styling. Use the project's existing sr-only / focus-visible utilities.
- The clipboard icon drawing. Match the stroke style of `staff-nav-icons.tsx`.
- How to reach 44px for each link: padding or `min-h-11` plus inline-flex, whichever keeps the layout identical.
- Test placement. Extend the existing e2e specs (`staff-shell.spec.ts`, `admin.spec.ts`, `accounts.spec.ts`) and the
  unit tests.
