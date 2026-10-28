# Redesign 2 ("สมุดบันทึกภาคสนาม จัดเต็ม") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนผิวทั้งเว็บเป็นแบบ "สมุดบันทึกภาคสนาม จัดเต็ม" (ธีมเขียว สว่าง/มืด) และทำหน้าแรกใหม่ที่มีเนื้อหา + กิจกรรม/รางวัล/บทความจริง บน branch `redesign-2`

**Architecture:** ต่อยอด token + ชิ้น UI กลางของแบบแรก (`globals.css`, `src/components/ui/`) เพิ่ม token/พื้นผิวกระดาษ, ปุ่มธีมแบบไอคอน, SiteHeader/SiteFooter และ section ของหน้าแรกที่รับข้อมูลผ่าน props (ทดสอบด้วย `renderToStaticMarkup`) ข้อมูลกิจกรรม/รางวัลสำหรับคนไม่ login มาจากฟังก์ชัน SQL ใหม่ 2 ตัว (ข้อยกเว้นที่เจ้าของอนุมัติ) ผ่าน lib ที่ `'use cache'` หน้า `/` ยัง static

**Tech Stack:** Next.js 16.4.2 App Router (Cache Components), React 19.3, Tailwind 4, Supabase (Postgres + pgTAP), Vitest (node env), Playwright

**Spec:** `docs/DESIGN-2.md` (อ่านทั้งไฟล์ก่อนเริ่มทุก Task) · แบบแรกอ้างอิง `docs/DESIGN.md` · mockup ที่ผ่าน: `.superpowers/brainstorm/10-1793165009/content/home-v5.html` (ใช้ดูหน้าตา/ค่า CSS ได้ แต่ spec ชนะ)

## Global Constraints

- ห้ามเปลี่ยนข้อความปุ่ม/ป้าย/เมนูเดิม, `data-testid` เดิม, ข้อความ aria เดิม · ข้อความใหม่ได้เฉพาะ DESIGN-2 §1.2 และ §5.3 (คำต่อคำ)
- ห้ามแตะ logic/SQL เดิม · พาธต้องห้าม: `supabase/migrations/`, `supabase/tests/`, `src/app/actions/`, `src/lib/`, `src/app/api/`, `scripts/`, `src/proxy.ts` · ยกเว้นไฟล์ใหม่ตรงชื่อ: `supabase/migrations/0026_public_home_feed.sql`, `supabase/tests/public_home_feed.test.sql`, `src/lib/home/public-feed.ts`, `src/lib/home/public-feed.test.ts`
- ห้ามเพิ่ม dependency, ห้าม `npm --force` / `--legacy-peer-deps`; ฟอนต์ผ่าน `next/font/google` เดิม; ของตกแต่งเป็น CSS/SVG inline (ไม่มีไฟล์รูปใหม่)
- `/` และ `/articles` ต้องเป็น ○ ใน `npm run build` (เทียบ `tests/redesign/build-routes.baseline.txt`) · ห้ามอ่าน cookie ใน scope ที่ cache
- ฟอร์ม/หัวข้อที่มี id ใช้ `useId()` (client) หรือ id นำหน้าด้วย route; ห้าม id ตายตัวซ้ำข้ามหน้าที่ `<Activity>` เก็บไว้
- 360 px ไม่มีแถบเลื่อนแนวนอนทั้งสองธีม · จุดกด ≥ 44 px · focus ring มองเห็นได้ · reduced motion ปิด animation/เอียง/ขยับทั้งหมด · ของตกแต่ง `aria-hidden` + `pointer-events-none`
- อย่าเรียง utility ที่ตั้ง property เดียวกันซ้อนกัน (Tailwind 4 ตัดสินด้วยลำดับ CSS ไม่ใช่ลำดับ class) ใช้ prop/variant แทน
- ก่อนแก้ UI ทุก Task อ่าน `.claude/skills/impeccable/reference/craft-floor.md` (ห้ามรันไบนารี `scripts/impeccable`)
- stage ทีละพาธเท่านั้น (ห้าม `git add -A`, `git add .`, `git commit -a`) แล้ว `git diff --cached --stat` ก่อน commit ทุกครั้ง · ห้าม stage `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`, `.agents/`, `.claude/`, `skills-lock.json`
- commit `feat: …` / `fix: …` / `docs: …` ลงท้าย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` · ห้าม merge/push
- **Gate (ครบก่อน commit ทุก Task):** เปิด Docker Desktop (`%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`) แล้ว
  ```
  npx supabase start
  npx supabase db reset
  npx supabase test db
  npm test
  npm run test:e2e
  npm run test:seed
  npm run test:e2e:prod
  npm run lint; npx tsc -p scripts/tsconfig.json; npm run build
  node tests/redesign/check-scope.mjs
  ```
  ผลที่ต้องได้ (ฐานเริ่ม): pgTAP ≥ 1021, vitest ≥ 633, e2e ≥ 165 ผ่าน (ข้าม ≤ 13 + ของใหม่ที่ chromium-only), seed 12, e2e:prod ≥ 24, lint 0 error, tsc/build ผ่าน, `scope OK`, `/` และ `/articles` ยัง ○ · e2e/e2e:prod ยาวเกิน 10 นาทีให้รันเบื้องหลัง
- **ภาพหน้าจอ (Task ที่แตะหน้า):** `npx playwright test -c tests/redesign/screens.config.ts --grep @<group>` ส่งรายชื่อไฟล์ใน `test-results/screens/<group>/` (ไม่ commit)

## Review Focus

1. กิจกรรมที่จบ "วันนี้" ตามเวลากรุงเทพ แต่วันที่ UTC ต่างกัน (เช่น จบ 23:30 น. กรุงเทพ) ต้องได้ "เหลือ 0 วัน" ไม่ใช่ 1 หรือติดลบ → test ใน Task 5
2. ชื่อกิจกรรม/รางวัล/บทความภาษาไทยยาวไม่มีช่องว่าง ต้องไม่ดันการ์ดเกินจอที่ 360 px (ตัดบรรทัด/จำกัด 2–3 บรรทัด) → render test + e2e 360 ใน Task 5
3. Supabase ล่มตอน build/รัน: lib คืน `null` → section แสดง fallback ตาม §5.4 และ `/` ยัง prerender ได้ → test ใน Task 4 (lib) และ Task 5 (section ด้วย `null`)
4. localStorage ใช้ไม่ได้ (private mode / ถูกบล็อก): ปุ่มธีมกดแล้วยังสลับธีมในหน้านั้นได้ ไม่ throw → test ใน Task 2
5. header ติดบนบังของที่ถูก focus/anchor เมื่อเลื่อนด้วยคีย์บอร์ดหรือ `#hash` → `html { scroll-padding-top }` ≥ ความสูง header ทดสอบใน Task 3

---

### Task 1: Token ใหม่, พื้นผิวกระดาษ, เครื่องมือ check-scope

**Files:**
- Modify: `src/app/globals.css` (token สว่าง + มืด 2 บล็อกให้เหมือนกัน, `@theme inline`, `@layer components` พื้นผิวกระดาษ, grain บน `body`)
- Modify: `src/app/theme-tokens.test.ts`
- Modify: `tests/redesign/check-scope.mjs`
- Create: `tests/redesign/ui-strings-2.allow.txt`

**Interfaces:**
- Produces: CSS vars `--paper-3 --kraft --kraft-2 --sun --sea --accent-deep --margin --line` และ Tailwind color `paper-3 kraft kraft-2 sun sea accent-deep` · class `paper-ruled paper-dots paper-grid paper-kraft paper-torn paper-grain` · check-scope อ่าน `ui-strings-2.allow.txt` (บรรทัดละ `text:…` หรือ `aria:…`) รวมเข้า ALLOWED_NEW และมี `ALLOWED_FILES` (4 ไฟล์ข้อยกเว้น) ที่ข้ามการเช็กพาธต้องห้าม

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** ใน `theme-tokens.test.ts`
  - `new tokens exist in light and both dark blocks` — ทั้ง 8 var มีในบล็อกสว่างและทั้งสองบล็อกมืด และค่าสองบล็อกมืดเท่ากัน
  - `kraft/paper-3 backgrounds keep AA text` — contrast(`--ink`, `--kraft`) ≥ 4.5, (`--ink`, `--kraft-2`) ≥ 4.5, (`--muted`, `--kraft`) ≥ 4.5, (`--ink`, `--paper-3`) ≥ 4.5, (`--muted`, `--paper-3`) ≥ 4.5, (`--accent`, `--kraft-2`) ≥ 3 — ทั้งสองธีม
  - `paper surfaces live in components layer` — `.paper-ruled`, `.paper-dots`, `.paper-grid`, `.paper-kraft`, `.paper-torn` อยู่ใน `@layer components`
- [ ] **Step 2:** `npx vitest run src/app/theme-tokens.test.ts` → FAIL (token ไม่มี)
- [ ] **Step 3: เพิ่ม token** ค่าเริ่มจาก DESIGN-2 §3.1 แปลงเป็น oklch ให้เข้ากับไฟล์ ปรับ L จนผ่าน AA · `--margin`/`--line` เป็น `color-mix(in oklab, var(--accent) 45%/12%, transparent)` (มืด 35%/8%) · พื้นผิว §3.3 (`paper-kraft` = `linear-gradient(180deg, var(--kraft-2), var(--kraft))`, `paper-torn` = pseudo-element ขอบฉีกด้านบนด้วย clip-path ใช้สีพื้นของ section) · grain เป็น data-URI `feTurbulence` บน `body` (class `paper-grain` ใช้ซ้ำได้)
- [ ] **Step 4:** vitest ไฟล์นี้ → PASS
- [ ] **Step 5: check-scope** โหลด `ui-strings-2.allow.txt` (ไฟล์ว่างได้ตอนนี้) เข้า ALLOWED_NEW; เพิ่ม `ALLOWED_FILES` = 4 ไฟล์ใน Global Constraints ข้ามการเช็กพาธ; ถอด `text:สว่าง`/`text:มืด`/`text:ตามระบบ` ออกจาก "ต้องยังอยู่ใน src" ได้ (ยังอยู่ใน ALLOWED_NEW) · ตรวจว่าแก้ไฟล์ต้องห้ามอื่น (เช่น แตะ `src/lib/datetime.ts` ชั่วคราว) ยังโดนจับ แล้วคืนไฟล์
- [ ] **Step 6: Gate** + ภาพ `@shell` แล้ว commit — `feat: notebook paper tokens and surfaces`

### Task 2: ปุ่มธีมแบบไอคอน

**Files:**
- Modify: `src/components/ui/theme.ts`, `src/components/ui/theme.test.ts`
- Modify: `src/components/ui/theme-toggle.tsx`
- Modify ผู้เรียก: `src/app/(auth)/layout.tsx:10`, `src/app/(public)/layout.tsx:20`, `src/app/(student)/layout.tsx:22`, `src/app/(student)/profile/page.tsx:59`, `src/app/page.tsx:15`, `src/app/staff/layout.tsx:25,38`
- Modify: `tests/e2e/theme.spec.ts`

**Interfaces:**
- Produces: `nextThemeChoice(showingDark: boolean): "light" | "dark"` (แสดงมืดอยู่ → `"light"`, ไม่งั้น `"dark"`) · `ThemeToggle({ className?: string })` ปุ่มเดียว `aria-label="ธีม"` `aria-pressed={showingDark}` ไม่มี prop `compact`
- Consumes: `THEME_STORAGE_KEY`, `applyThemeChoice`, `readThemeChoice`, `THEME_INIT_SCRIPT` (ไม่เปลี่ยน)

- [ ] **Step 1: เทสต์ที่ล้ม** ใน `theme.test.ts`: `nextThemeChoice(true) === "light"`, `nextThemeChoice(false) === "dark"`; `applyThemeChoice("dark", storageThatThrows)` ไม่ throw และตั้ง `data-theme="dark"` บน root จำลอง (Review Focus 4)
- [ ] **Step 2:** `npx vitest run src/components/ui/theme.test.ts` → FAIL
- [ ] **Step 3:** เพิ่ม `nextThemeChoice` ใน `theme.ts`; เขียน `theme-toggle.tsx` ใหม่: `showingDark` = `data-theme==="dark"` หรือ (ไม่มี attribute และ `matchMedia('(prefers-color-scheme: dark)').matches`) อ่านผ่าน `useSyncExternalStore` (subscribe `storage`, `themechange`, media query change; server snapshot = `false`) · กด → `applyThemeChoice(nextThemeChoice(showingDark), storage)` + dispatch `themechange` · ไอคอนดวงอาทิตย์+พระจันทร์ SVG inline ทั้งคู่อยู่ใน DOM สลับด้วย CSS `dark:` variant (ไม่ขึ้นกับ state → ไม่ hydration mismatch) · คง `useLayoutEffect` ที่ re-apply ค่าจาก storage (ไม่ใช่จาก state) · ขนาด 44×44 เงาพิมพ์นูนแบบปุ่มรอง
- [ ] **Step 4:** vitest → PASS; แก้ผู้เรียกทุกตัว (เอา `compact` ออก, staff sidebar ลบ className `[&_[role=radio]]…` ทิ้ง ใช้ `mt-auto self-start`)
- [ ] **Step 5: ปรับ e2e** `theme.spec.ts`: แทนที่การหา radiogroup/radio ด้วย `getByRole("button", { name: "ธีม" })` · เทสต์ใหม่ `icon toggle flips from system`: emulate `colorScheme: "light"` → ไม่มี `data-theme` → กด → `dark` → กด → `light` → reload ยัง `light` · `colorScheme: "dark"` → กดครั้งแรก → `light` · เทสต์ no-flash MutationObserver เดิมต้องผ่าน · เทสต์ sidebar 768 px ยังเห็นปุ่ม
- [ ] **Step 6: Gate** + ภาพ `@shell` `@public` แล้ว commit — `feat: icon theme toggle (system default, dark/light flip)`

### Task 3: ชิ้นส่วนกลาง: ปุ่ม, การ์ด, SiteHeader, SiteFooter, โซเชียล

**Files:**
- Modify: `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/index.ts`, `src/components/ui/ui.test.ts`
- Create: `src/app/_components/site-header.tsx`, `src/app/_components/site-footer.tsx`, `src/app/_components/social-links.ts`, `src/app/_components/social-icons.tsx`, `src/app/_components/social-links.test.ts`
- Modify: `src/app/(public)/layout.tsx`, `src/app/(auth)/layout.tsx`, `src/app/globals.css` (`scroll-padding-top`)
- Modify: `tests/redesign/ui-strings-2.allow.txt` (footer: เริ่มต้น, อ่าน, ค่า carbon อ้างอิง อบก. LESS-WM-01 v06, aria Facebook/YouTube/Instagram/X/LINE)
- Test: `tests/e2e/theme.spec.ts` (หรือ `tests/e2e/home.spec.ts` ใหม่สำหรับ header)

**Interfaces:**
- Consumes: `ThemeToggle` (Task 2), class/สี Task 1
- Produces:
  - `Card({ as?, tone?, flush?, deco?: "tape" | "clip" | "pin", tilt?: boolean, ... })` — `deco` เรนเดอร์ `<span aria-hidden class="pointer-events-none …">`; `tilt` เพิ่ม class เอียง (ตามลำดับลูกคู่/คี่ผ่าน `nth-child` ของ parent ได้) + `hover:rotate-0` + `motion-reduce:rotate-0`
  - `buttonClass` variant `primary`/`secondary` มีเงาพิมพ์นูนหลายชั้น (`--accent-deep` / `--rule`)
  - `SiteHeader()` (server component) · `SiteFooter()` (server component)
  - `type SocialPlatform = "facebook" | "youtube" | "instagram" | "x" | "line"` · `SOCIAL_LINKS: readonly { platform: SocialPlatform; label: string; href: string }[]` (href `""` ทั้งหมด) · `visibleSocialLinks(links = SOCIAL_LINKS)` คืนเฉพาะ href ที่ trim แล้วไม่ว่าง · `SocialIcon({ platform })`

- [ ] **Step 1: เทสต์ที่ล้ม**
  - `social-links.test.ts`: `visibleSocialLinks([])` = `[]`; ค่าเริ่ม (href ว่างทั้งหมด) → `[]`; `[{…href:"https://x.com/a"}, {…href:"  "}]` → ยาว 1
  - `ui.test.ts`: `Card deco="tape"` markup มี `aria-hidden="true"` และ `pointer-events-none`; `Card tilt` มี class `motion-reduce:rotate-0`; `buttonClass({variant:"primary"})` มี `shadow-` เพียง token เดียว (ไม่ซ้อน)
  - `theme-tokens.test.ts`: `html` มี `scroll-padding-top` ≥ `4rem` (Review Focus 5)
- [ ] **Step 2:** `npx vitest run src/components/ui src/app/_components/social-links.test.ts src/app/theme-tokens.test.ts` → FAIL
- [ ] **Step 3:** implement ตาม Interfaces และ DESIGN-2 §4 · SiteHeader: `<header class="sticky top-0 z-40 backdrop-blur …">` ลำดับ โลโก้ใบไม้ + "Green Campus" (ลิงก์ `/`) · `ThemeToggle` · ลิงก์ "บทความ" (`hidden sm:inline-flex`) · "เข้าสู่ระบบ" · ปุ่ม "สมัครสมาชิก" — ข้อความ/ href เดิมจาก layout เดิม · SiteFooter: §4 (ไม่มี border-top) แสดงโซเชียลเมื่อ `visibleSocialLinks().length > 0` ลิงก์ `target="_blank" rel="noopener noreferrer"` 44×44 · ใช้ใน `(public)` และ `(auth)` layout แทน header เดิม
- [ ] **Step 4:** vitest → PASS
- [ ] **Step 5: e2e** `header stays visible after scroll` (หน้า `/articles` เติมเนื้อหาไม่พอให้ใช้ `/` หลัง Task 5 — ตอนนี้ทดสอบที่ `/articles` ด้วย `page.setViewportSize({height: 400})` แล้ว `window.scrollTo(0, 1000)` → `header` boundingBox.y ≈ 0) · ไม่มี id ซ้ำ `/articles` ↔ `/login`
- [ ] **Step 6: Gate** + ภาพ `@public` แล้ว commit — `feat: letterpress buttons, decorated cards, site header and footer`

### Task 4: ข้อมูลหน้าแรกสำหรับคนไม่ login (ข้อยกเว้น DESIGN-2 §1.3)

**Files:**
- Create: `supabase/migrations/0026_public_home_feed.sql` (SQL ตาม DESIGN-2 §7.1 คำต่อคำ เทียบรูปแบบ `0025_public_stats_students.sql`)
- Create: `supabase/tests/public_home_feed.test.sql`
- Create: `src/lib/home/public-feed.ts`, `src/lib/home/public-feed.test.ts`
- Modify: `tests/redesign/ui-strings.baseline.txt` (เฉพาะบรรทัด `use-cache-count:5` → `7`)

**Interfaces:**
- Produces:
  ```ts
  export type PublicActivity = { id: string; title: string; type: string; startsAt: string; endsAt: string };
  export type PublicReward = { id: string; name: string; pointsCost: number; stock: number; imageUrl: string | null };
  export function parseOpenActivities(data: unknown): PublicActivity[] | null;   // pure
  export function parseActiveRewards(data: unknown, toUrl: (path: string) => string): PublicReward[] | null; // pure
  export async function getOpenActivities(): Promise<PublicActivity[] | null>;   // 'use cache', rpc public_open_activities, p_limit 3
  export async function getActiveRewards(): Promise<PublicReward[] | null>;      // 'use cache', rpc public_active_rewards, p_limit 4
  ```

- [ ] **Step 1: pgTAP ที่ล้ม** `public_home_feed.test.sql` (รูปแบบเดียวกับไฟล์ใน `supabase/tests/` เช่น `begin; select plan(N); … rollback;`):
  - `has_function` ทั้งสอง · `is(prosecdef, true)` · `proconfig` มี `search_path=""`
  - ตั้ง role `anon`: เรียกได้ทั้งสอง
  - seed กิจกรรม: open/ยังไม่จบ (A จบพรุ่งนี้, B จบอีก 5 วัน), open/จบเมื่อวาน, draft, closed → `public_open_activities(3)` คืน [A, B] ตามลำดับ
  - seed รางวัล: active stock 5 (ใหม่), active stock 0, inactive stock 5, active stock 2 (เก่า) → คืน [ใหม่, เก่า]
  - clamp: `p_limit` 0 → 1 แถว, null → ค่าเริ่ม, 99 → ≤ 12
  - คอลัมน์: ผลของ `public_open_activities` มีเฉพาะ `id,title,type,starts_at,ends_at`
- [ ] **Step 2:** `npx supabase test db` → FAIL (ฟังก์ชันไม่มี)
- [ ] **Step 3:** สร้าง migration → `npx supabase db reset` → `npx supabase test db` → PASS ทั้งหมด (เดิม 1021 + ใหม่)
- [ ] **Step 4: vitest ที่ล้ม** `public-feed.test.ts`: `parseOpenActivities` แปลง snake→camel; non-array / แถวขาด field → `null`; `parseActiveRewards` ใช้ `toUrl` เฉพาะแถวที่มี `image_path` (ไม่มี → `imageUrl: null`) — Review Focus 3
- [ ] **Step 5:** `npx vitest run src/lib/home/public-feed.test.ts` → FAIL → implement ตามรูปแบบ `src/lib/leaderboard/public-stats.ts` คำต่อคำ (error/parse ล้ม → `console.error` + `cacheLife("seconds")` + `return null`; สำเร็จ → `cacheLife("minutes")`) · URL รูปใช้ `createAnonClient().storage.from("reward-images").getPublicUrl(path).data.publicUrl` → PASS
- [ ] **Step 6:** แก้ `use-cache-count:7` · `node tests/redesign/check-scope.mjs` → `scope OK`
- [ ] **Step 7: Gate** แล้ว commit — `feat: public home feed functions for open activities and rewards`

### Task 5: หน้าแรก

**Files:**
- Modify: `src/app/page.tsx` (ประกอบ section; การดึงสถิติ/`<Suspense>` เดิมคงไว้)
- Create (ใน `src/app/_components/home/`): `activity-progress.ts`, `activity-progress.test.ts`, `hero.tsx`, `hero-art.tsx`, `section-heading.tsx`, `problem-section.tsx`, `process-section.tsx`, `audience-section.tsx`, `facts-section.tsx`, `activities-section.tsx`, `rewards-section.tsx`, `articles-section.tsx`, `closing-cta.tsx`, `home-sections.test.ts`
- Modify: `src/app/globals.css` (keyframes ไฮไลต์/ใบไม้ร่วง/จุดกะพริบ + ปิดใน reduced motion)
- Modify: `tests/redesign/ui-strings-2.allow.txt` (ข้อความ DESIGN-2 §5.3 ทั้งหมด)
- Create: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `getPublicStats()` เดิม, `getOpenActivities()`/`getActiveRewards()` (Task 4), `listPublishedArticles()` เดิม, `typeLabelTh()` เดิม, `formatBangkok()` เดิม, `RewardImage` เดิม, `Card`/`ButtonLink`/`SiteHeader`/`SiteFooter` (Task 3)
- Produces:
  - `activityProgress(startsAt: string, endsAt: string, now: Date): { percent: number; daysLeft: number }`
  - `SectionHeading({ id: string; num: string; kicker: string; title: ReactNode })` — `id` นำหน้า `home-`
  - `ActivitiesSection({ activities: PublicActivity[] | null; now: Date })`, `RewardsSection({ rewards: PublicReward[] | null })`, `ArticlesSection({ articles: PublicArticleSummary[] | null })` — เป็น presentational (ไม่ fetch) · async wrapper ใน `page.tsx` เรียก lib แล้วส่ง props ภายใน `<Suspense>` ของตัวเอง (fallback skeleton ขนาดเท่าจริง)

- [ ] **Step 1: เทสต์ที่ล้ม** `activity-progress.test.ts` (เวลา ISO มี `+07:00`):
  - ยังไม่เริ่ม: starts `2026-11-01T08:00+07:00`, ends `2026-11-10T17:00+07:00`, now `2026-10-30T12:00+07:00` → `{percent:0, daysLeft:11}`
  - ระหว่าง: starts `2026-11-01T00:00+07:00`, ends `2026-11-11T00:00+07:00`, now `2026-11-06T00:00+07:00` → percent 50, daysLeft 5
  - วันสุดท้าย (Review Focus 1): ends `2026-11-10T23:30+07:00`, now `2026-11-10T08:00+07:00` → daysLeft 0
  - ข้ามเที่ยงคืนกรุงเทพ: ends `2026-11-11T00:30+07:00` (UTC ยังวันที่ 10), now `2026-11-10T23:50+07:00` → daysLeft 1
  - เลยแล้ว: now หลัง ends → `{percent:100, daysLeft:0}` · starts == ends → percent 100 เมื่อ now ≥ ends, 0 เมื่อก่อน (ไม่หารศูนย์)
- [ ] **Step 2:** vitest → FAIL → implement (percent = clamp(round((now−start)/(end−start)×100),0,100); daysLeft = ผลต่างวันปฏิทิน Asia/Bangkok ระหว่าง `now` กับ `endsAt`, ไม่ต่ำกว่า 0) → PASS
- [ ] **Step 3: render test ที่ล้ม** `home-sections.test.ts` (`renderToStaticMarkup`):
  - `ActivitiesSection` 2 กิจกรรม → มี "ชั่งน้ำหนักขยะ" (จาก `typeLabelTh`), "เหลือ", "เข้าสู่ระบบเพื่อเข้าร่วม", ลิงก์ `/activities/<id>`, `role="progressbar"` + `aria-valuenow`
  - `ActivitiesSection []` → "ยังไม่มีกิจกรรมที่เปิดรับ" · `null` → "ยังโหลดกิจกรรมไม่ได้ในขณะนี้"
  - `RewardsSection []` และ `null` → `""` (ซ่อนทั้งหัวข้อ) · 1 รางวัล → "N แต้ม" (ตัวเลขใน `Mono`), "เหลือ", "เข้าสู่ระบบเพื่อแลก", ลิงก์ `/rewards`
  - `ArticlesSection` 6 บทความ → แสดง 4 · `[]`/`null` → `""` · มีลิงก์ `/articles` "ดูบทความทั้งหมด →"
  - ชื่อยาวไม่มีช่องว่าง 200 ตัว → การ์ดมี class `break-words` (หรือ `line-clamp-*`) และ `min-w-0` (Review Focus 2)
- [ ] **Step 4:** vitest → FAIL → implement section ตาม DESIGN-2 §5.1–§5.5 (ข้อความคำต่อคำจาก §5.3; พื้นผิวจาก Task 1; ลูกเล่นตามตาราง §2; hero-art เป็น SVG inline `aria-hidden` ตาม mockup) → PASS · เพิ่มข้อความลง `ui-strings-2.allow.txt` จนกว่า check-scope จะผ่าน (ต้องเป็นข้อความใน §5.3 เท่านั้น)
- [ ] **Step 5: e2e ที่ล้มก่อน** `home.spec.ts`:
  - `hero CTA sends anonymous visitor to login with next` — คลิก "ดูกิจกรรมที่เปิดรับ →" → URL ตรง `/login?next=%2Factivities`
  - `sections render` — เห็น heading "กิจกรรมที่เปิดรับอยู่" และ stat `data-testid` เดิม 3 ตัว
  - `header sticky on home` — เลื่อน 1500 px → `header` y ≈ 0
  - `no horizontal scroll at 360` — viewport 360×800 ทั้งสองธีม `scrollWidth <= clientWidth` (ก่อนวัด seed กิจกรรม open ชื่อยาวไม่มีช่องว่างด้วย helper ใหม่ใน `tests/e2e/helpers/supabase-admin.ts` แล้วลบหลังจบ; ไม่ assert ว่าการ์ดนั้นต้องแสดงเพราะ cache)
  - `reduced motion stops decorations` — `reducedMotion: "reduce"` → ทุก element ใน `[data-deco]` มี `getAnimations().length === 0` และ `.leaf-fall` (หรือชื่อที่ใช้) `display:none`
  - `no duplicate ids` — `/` → `/articles` → `/login` → `/` (client nav)
- [ ] **Step 6:** `npx playwright test tests/e2e/home.spec.ts --project=chromium` → PASS
- [ ] **Step 7: Gate** (ดู build: `/` ยัง ○ 1m/1h) + ภาพ `@public` แล้ว commit — `feat: notebook home page with activities, rewards and articles`

### Task 6: หน้าสาธารณะและ auth

**Files:** `src/app/(public)/articles/page.tsx`, `src/app/(public)/articles/[slug]/page.tsx`, `src/app/(public)/article-not-found/page.tsx`, `src/app/(auth)/_components/ui.tsx`, หน้าใน `src/app/(auth)/*/page.tsx` + form ที่เกี่ยว (className/โครงตกแต่งเท่านั้น)

**Interfaces:** Consumes `Card deco/tilt`, `SiteHeader/SiteFooter` (Task 3)

- [ ] **Step 1:** ปรับตาม DESIGN-2 §6: การ์ดบทความ `tilt` + `deco="pin"`, การ์ดฟอร์ม auth `deco="tape"`, หัวข้อหน้ามีไฮไลต์, `/articles/[slug]` ตัวอ่าน ≤ 65ch ไม่มีลูกเล่นในเนื้อหา
- [ ] **Step 2:** ตรวจตาม `.claude/skills/impeccable/reference/audit.md` (contrast, focus, 44 px, ลำดับอ่าน) จดผลใน report
- [ ] **Step 3:** e2e เดิมของบทความ/auth/ฟอร์มผ่าน (`npx playwright test tests/e2e/articles.spec.ts tests/e2e/nav.spec.ts tests/e2e/preserved-forms.spec.ts --project=chromium`) + 360 px `/articles`, `/login` ไม่มี horizontal scroll (เพิ่มใน `theme.spec.ts` ถ้ายังไม่มี)
- [ ] **Step 4: Gate** (`/articles` ยัง ○) + ภาพ `@public` แล้ว commit — `feat: notebook public and auth pages`

### Task 7: หน้านักศึกษา

**Files:** `src/app/(student)/layout.tsx` และหน้าใน `src/app/(student)/**` + `src/app/_components/*` ที่หน้าเหล่านี้ใช้ (className/ตกแต่งเท่านั้น)

- [ ] **Step 1:** ตาม DESIGN-2 §2 (โหมด Operate) และ §6: การ์ดสรุป dashboard `deco="tape"`, ไม่มี `tilt` ในรายการ/ฟอร์ม/ตะกร้า/คำสั่งซื้อ, ปุ่มเงาพิมพ์นูนมาจาก Task 3 แล้ว
- [ ] **Step 2:** audit ตาม `audit.md` จดผล
- [ ] **Step 3:** 360 px `/dashboard` ไม่มี horizontal scroll (seed ข้อมูลแบบเทสต์เดิม)
- [ ] **Step 4: Gate** + ภาพ `@student` แล้ว commit — `feat: notebook student pages`

### Task 8: หน้าเจ้าหน้าที่

**Files:** `src/app/staff/layout.tsx` และหน้าใน `src/app/staff/**` (className/ตกแต่งเท่านั้น), `src/components/charts/WasteByCategory.tsx` ห้ามเปลี่ยนสี

- [ ] **Step 1:** เบาที่สุดตาม §6: ตาราง/ฟอร์มไม่ตกแต่ง, การ์ดสรุปบนหน้า `/staff` ได้ `deco="clip"` อย่างมาก, weigh-station ไม่มีอะไรขยับนอกจากตัวนับถอยหลังเดิม
- [ ] **Step 2:** audit ตาม `audit.md` จดผล
- [ ] **Step 3:** 360 px `/staff` + sidebar 768 px ปุ่มธีมพอดี (เทสต์เดิมใน `theme.spec.ts`)
- [ ] **Step 4: Gate** + ภาพ `@staff` แล้ว commit — `feat: notebook staff pages`

### Task 9: ตรวจ Impeccable, เก็บงาน, ปิด spec

**Files:** ทุกไฟล์ที่ Task 1–8 แตะ (แก้เฉพาะที่พบ), `docs/DESIGN-2.md` (§10 + สถานะ)

- [ ] **Step 1:** ไล่ `.claude/skills/impeccable/reference/polish.md` และ `audit.md` กับ `/`, `/articles`, `/login`, `/dashboard`, `/staff`, `/staff/weigh-station` ทั้งสองธีม ที่ 360 และ 1280 px (สคริปต์ Playwright ภาพหน้าจอ) แก้สิ่งที่ผิดเกณฑ์ craft-floor
- [ ] **Step 2:** ลบ log/โค้ดตาย, ตรวจว่าไม่มี `compact` ค้าง (`grep -rn "compact" src`), ไม่มี class สีเก่าโผล่
- [ ] **Step 3:** เขียน DESIGN-2 §10: ผล gate สุดท้าย, บรรทัด build ของ `/` และ `/articles`, ตัวเลขเทสต์ก่อน/หลัง; เปลี่ยนสถานะหัวไฟล์เป็น "ใช้งานแล้ว บน branch redesign-2"
- [ ] **Step 4: Gate** + ภาพทุกกลุ่ม แล้ว commit — `docs: redesign 2 complete`
