# Green Campus Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนหน้าตาทั้งเว็บเป็นธีมเขียวแนว Hallmark Coral (เบากว่า) มีธีมสว่าง/มืด สลับเองได้และตามระบบ โดยพฤติกรรม ข้อความ และเทสต์เดิมไม่เปลี่ยน

**Architecture:** token สีเชิงความหมายเป็น CSS variable ใน `globals.css` ผูกเป็น utility ของ Tailwind 4 ผ่าน `@theme inline` ธีมตั้งด้วย `data-theme` บน `<html>` จากสคริปต์ inline ใน `<head>` + `localStorage` (ไม่มี cookie) ชิ้น UI กลางบาง ๆ ใน `src/components/ui/` แล้วย้ายหน้าทีละกลุ่ม ระหว่างทาง `gray`/`green` ของ Tailwind ถูก remap เป็นโทนใหม่เพื่อไม่ให้หน้าที่ยังไม่ย้ายขัดตา

**Tech Stack:** Next.js 16.4.2 (App Router, Cache Components), Tailwind 4, `next/font/google` (Sarabun, IBM Plex Sans Thai, Geist Mono), Recharts 3.10.1, Vitest 5 (environment `node`), Playwright

**Spec:** `docs/DESIGN.md` (ข้อห้ามคือ §1 ทุกข้อ, ออกแบบคือ §2–§5, เทสต์เพิ่มคือ §6) ผู้ลงมือต้องอ่านคู่กันทั้งไฟล์ อ่าน `AGENTS.md` และ `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` ก่อนแตะ layout

## Global Constraints

- ทำบน branch `redesign` เท่านั้น ห้ามแตะ `main`
- ห้ามแก้: `supabase/migrations/**`, `supabase/tests/**`, `src/app/actions/**`, `src/lib/**`, `src/proxy.ts`, `src/app/api/**`, `scripts/**` (DESIGN §1.1)
- ห้ามเปลี่ยนวิธีดึงข้อมูล (query, select, ลำดับ), `requireStaff`/`requireAdmin`/`getCurrentUser`, `<Suspense>`, `await connection()`; ห้ามเพิ่มหรือแก้ `'use cache'` (ตอนนี้มี 6 จุดใน `src`)
- ห้ามเปลี่ยน route, ข้อความไทยบนปุ่ม/ลิงก์/หัวข้อ/ป้าย/error/สถานะว่าง, ชื่อเมนู, `data-testid`, `data-realtime`/`data-user-id`/`data-slug`/`data-bottom-nav`, `aria-label` ของ nav (`"เมนูหลัก"`, `"เมนูผู้ดูแล"`, `"เมนูสาธารณะ"`), `aria-current`/`aria-expanded`/`aria-controls`, `role="alert"`, `<label htmlFor>`; ปุ่มต้องเป็น `<button>` ลิงก์ต้องเป็น `<a>`/`<Link>` (DESIGN §1.2)
- ข้อความใหม่ที่อนุญาตมีแค่ของ ThemeToggle: `"ธีม"`, `"สว่าง"`, `"มืด"`, `"ตามระบบ"`
- ฟอร์มใช้ `useId()` ห้าม `id` ตายตัว; ห้ามรื้อการรีเซ็ต state หลังบันทึก
- ไม่มีแถบเลื่อนแนวนอนที่ 360 px ทั้งสองธีม; จุดกด ≥ 44 px; focus ring มองเห็นได้; เคารพ `prefers-reduced-motion`
- ห้ามเพิ่ม dependency, ห้าม `npm --force` / `--legacy-peer-deps`; ฟอนต์ผ่าน `next/font/google` เท่านั้น
- `<img>` ของรูปจาก Storage คงเป็น `<img>` (ไม่เปลี่ยนเป็น `next/image`); PDF (`src/lib/pdf/**`) ไม่อยู่ในงานนี้
- ตัวเลขยังจัดรูปแบบด้วย `th-TH` และเวลา Asia/Bangkok ตามเดิม
- commit แบบ `feat: …` / `fix: …` / `docs: …` ลงท้ายด้วยบรรทัด `Co-Authored-By` ตามที่ session กำหนด
- **Gate (ต้องผ่านครบก่อน commit ทุก Task ตามที่เจ้าของโปรเจกต์สั่ง):** เปิด Docker Desktop แล้วรันตามลำดับ (HANDOFF §9)
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
  ผลที่ต้องได้: pgTAP 1021 ผ่าน, vitest ≥ 556 ผ่าน (บวกเทสต์ใหม่), e2e ≥ 134 ผ่าน ข้าม 6 (บวกเทสต์ใหม่), seed 12 ผ่าน, e2e:prod ≥ 24 ผ่าน, lint/tsc/build ผ่าน, check-scope พิมพ์ `scope OK`
- **ภาพหน้าจอ (ทุก Task ที่แตะหน้า):** `npx playwright test -c tests/redesign/screens.config.ts --grep @<group>` แล้วส่งรายชื่อไฟล์ใน `test-results/screens/<group>/` ให้เจ้าของโปรเจกต์ดู ภาพไม่ commit

## Review Focus

1. **Hydration ของ ThemeToggle:** เซิร์ฟเวอร์ไม่รู้ค่าที่เก็บไว้ ถ้าคอมโพเนนต์อ่าน `localStorage` ตอน render แรกจะเกิด hydration error ต้องใช้ `useSyncExternalStore` ที่ server snapshot = `"system"` (Task 3: e2e ตรวจว่าไม่มี console error `Hydration` หลัง reload ทั้งตอนเลือก "มืด")
2. **token มืดสองชุดไม่ตรงกัน:** ธีมมืดประกาศสองที่ (`[data-theme=dark]` และ media query ของ "ตามระบบ") ถ้าแก้ที่เดียว ผู้ใช้ที่ตั้งมืดเองกับที่ตามระบบจะเห็นสีต่างกัน (Task 2: vitest เทียบสองบล็อกต้องเท่ากันทุกตัว)
3. **ปุ่มในฟอร์มเปลี่ยนชนิดเงียบ ๆ:** ถ้า `Button` ใส่ `type="button"` เป็นค่าเริ่มต้น ปุ่มส่งฟอร์มเดิมที่ไม่ได้ระบุ `type` จะกดแล้วไม่ส่ง (Task 4: vitest ตรวจว่า `Button` ที่ไม่ส่ง `type` ไม่มี attribute `type`)
4. **localStorage ใช้ไม่ได้ (Safari โหมดส่วนตัว / ถูกบล็อก):** สคริปต์ใน `<head>` และปุ่มสลับต้องไม่ throw และหน้าต้องยังแสดงตามระบบ (Task 3: vitest รันสคริปต์กับ storage ที่ throw)
5. **ตารางกว้างบนจอ 360 px หลังเปลี่ยน padding/ฟอนต์:** ฟอนต์หัวข้อใหม่กว้างกว่าเดิม หัวตารางหรือแถวปุ่มอาจดันหน้าให้เลื่อนแนวนอน (Task 9, 10: e2e `noSideScroll` บน `/staff/reports` และ `/staff/orders` ที่ 360 px ทั้งสองธีม)

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `tests/redesign/check-scope.mjs` | ตรวจขอบเขต: ไม่มีไฟล์ต้องห้ามใน diff, ข้อความ UI ไม่หาย, `'use cache'` เท่าเดิม |
| `tests/redesign/ui-strings.baseline.txt` | ชุดข้อความไทย / testid / aria-label จาก `main` (สร้างครั้งเดียวใน Task 1) |
| `tests/redesign/screens.config.ts`, `screens.spec.ts` | ถ่ายภาพหน้าจอ 360/1280 × สว่าง/มืด แยกกลุ่มด้วย tag |
| `src/app/globals.css` | token, remap gray/green, `@custom-variant dark`, base style |
| `src/app/theme-tokens.test.ts` | อ่าน `globals.css` คำนวณ contrast ตาม DESIGN §3.1 |
| `src/components/ui/theme.ts` (+ `.test.ts`) | logic ธีมล้วน (ไม่มี React) + สคริปต์ inline |
| `src/components/ui/theme-toggle.tsx` | ปุ่มสลับธีม (client) |
| `src/components/ui/{button,card,field,badge,stat,page-header,empty-state}.tsx` | ชิ้น UI กลาง |
| `src/components/ui/index.ts` | re-export ทั้งหมด |
| `src/components/ui/ui.test.ts` | render ด้วย `react-dom/server` ตรวจการส่งต่อ props |
| `src/app/staff/weigh-station/_components/countdown-tone.ts` (+ `.test.ts`) | เลือกโทนสีนับถอยหลังจากเวลาที่เหลือ |
| `tests/e2e/theme.spec.ts` | e2e ธีม |

---

### Task 1: เครื่องมือคุมขอบเขตและถ่ายภาพหน้าจอ

**Files:**
- Create: `tests/redesign/check-scope.mjs`, `tests/redesign/ui-strings.baseline.txt`, `tests/redesign/screens.config.ts`, `tests/redesign/screens.spec.ts`

**Interfaces:**
- Produces: `node tests/redesign/check-scope.mjs` (exit 0 + พิมพ์ `scope OK`, ไม่ผ่าน exit 1 พร้อมรายการปัญหา) · `node tests/redesign/check-scope.mjs --write-baseline` · screens tag: `@shell`, `@public`, `@student`, `@staff`

- [ ] **Step 1: เขียน `check-scope.mjs`** (Node ESM ไม่มี dependency) ทำ 3 อย่าง:
  1. `git diff --name-only main...HEAD` รวมกับ `git diff --name-only` (working tree) ต้องไม่มี path ขึ้นต้นด้วย `supabase/migrations/`, `supabase/tests/`, `src/app/actions/`, `src/lib/`, `src/app/api/`, `scripts/` หรือเท่ากับ `src/proxy.ts`
  2. ดึงชุดข้อความจาก `src/**/*.tsx` (ไม่รวม `*.test.*`) หลังตัดคอมเมนต์ `//…` และ `/* … */` และ `{/* … */}` ออกก่อน (ลบคอมเมนต์ได้โดยไม่ล้ม): (ก) ลำดับอักษรไทย `/[฀-๿][฀-๿\s0-9A-Za-z.,:;!?()\/%-]*/g` ตัดช่องว่างหัวท้าย (ข) ค่า `data-testid` (ค) ค่า `aria-label` (รวมทั้งที่เป็น template literal เก็บเป็นข้อความดิบ) ทำเป็น set เรียงลำดับ บรรทัดละค่า ขึ้นต้นด้วย `text:`, `testid:`, `aria:`
     - `--write-baseline` เขียน set ลง `ui-strings.baseline.txt`
     - ปกติ: baseline − ปัจจุบัน ต้องว่าง; ปัจจุบัน − baseline ต้องอยู่ใน allowlist `text:ธีม`, `text:สว่าง`, `text:มืด`, `text:ตามระบบ`, `aria:ธีม`
  3. นับ `'use cache'`/`"use cache"` ใน `src/**` ต้องเท่ากับ 6
- [ ] **Step 2: สร้าง baseline:** ตอนนี้ `src/` บน `redesign` ยังเหมือน `main` ทุกไฟล์ (ตรวจด้วย `git diff --stat main -- src` ต้องว่าง) จึงรัน `node tests/redesign/check-scope.mjs --write-baseline` บน branch นี้ได้เลย ตรวจว่าไฟล์มีบรรทัด `aria:เมนูหลัก`, `aria:เมนูผู้ดูแล`, `text:ยืนยันแลก`, `text:เตรียมของเสร็จแล้ว`
- [ ] **Step 3: ทดสอบว่าเครื่องมือจับได้จริง:** แก้ชั่วคราว `"ยืนยันแลก"` ในไฟล์ที่มีข้อความนี้เป็น `"ยืนยัน"` → รัน → ต้อง exit 1 และระบุ `text:ยืนยันแลก` แล้ว `git checkout -- <ไฟล์>` → รัน → `scope OK`
- [ ] **Step 4: เขียน screens harness:** `screens.config.ts` = `defineConfig` ที่ `testDir: "./tests/redesign"`, `testMatch: "screens.spec.ts"`, `workers: 1`, `use.baseURL: "http://localhost:3000"`, `locale: "th-TH"`, `timezoneId: "Asia/Bangkok"`, `webServer` เหมือน `playwright.config.ts` (`npm run dev`, reuse) · `screens.spec.ts` สร้างผู้ใช้ student + teacher + admin ด้วย `createConfirmedUser` และลบด้วย `deleteUsers` ใน `afterAll` ล็อกอินแบบเดียวกับ `tests/e2e/nav.spec.ts` แล้ววนทุก route ในกลุ่ม × กว้าง `[360, 1280]` × ธีม `["light","dark"]` (ตั้งธีมด้วย `page.addInitScript(t => localStorage.setItem("theme", t), theme)`) บันทึก `test-results/screens/<group>/<slug>-<width>-<theme>.png` แบบ `fullPage: true` กลุ่ม:
  - `@public`: `/`, `/articles`, `/login`, `/register`, `/forgot-password`
  - `@student`: `/dashboard`, `/activities`, `/my-submissions`, `/leaderboard`, `/rewards`, `/cart`, `/orders`, `/notifications`, `/profile`
  - `@staff` (admin): `/staff`, `/staff/reviews`, `/staff/activities`, `/staff/activities/new`, `/staff/weigh-station`, `/staff/orders`, `/staff/rewards`, `/staff/rewards/new`, `/staff/articles`, `/staff/articles/new`, `/staff/reports`, `/staff/users`, `/staff/rates`, `/staff/profile`, `/staff/notifications`
  - `@shell`: `/articles`, `/dashboard`, `/staff` (ใช้ดูโครงหน้า)
- [ ] **Step 5: รัน** `npx playwright test -c tests/redesign/screens.config.ts --grep @shell` ต้องได้ 12 ไฟล์ (ภาพ "ก่อน" ย้ายไป `test-results/screens/before/` ไว้เทียบ)
- [ ] **Step 6: Gate** ระหว่างนั้นคัดบรรทัดของ route `/` และ `/articles` จากตาราง route ที่ `npm run build` พิมพ์ ลง `tests/redesign/build-routes.baseline.txt` (ใช้เทียบใน Task 3, 6, 12 ว่าสัญลักษณ์ prerender ไม่เปลี่ยน) แล้ว commit `tests/redesign/*` — `chore: redesign scope check and screenshot harness`

---

### Task 2: token สี ฟอนต์ remap และ dark variant

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Test: `src/app/theme-tokens.test.ts`

**Interfaces:**
- Produces (utility ที่ Task ถัดไปใช้): สี `paper`, `paper-2`, `surface`, `ink`, `muted`, `rule`, `rule-strong`, `accent`, `on-accent`, `accent-soft`, `danger`, `warn`, `chart-1`…`chart-4` (เช่น `bg-paper`, `text-muted`, `border-rule-strong`) · ฟอนต์ `font-display`, `font-sans`, `font-mono` · `shadow-card`, `shadow-cast`, `shadow-cast-lift` · `rounded-card` (8px), `rounded-input` (6px) · ตัวแปร `--ease-out`, `--dur-micro`, `--dur-short` · variant `dark:` ที่ตาม `data-theme` และระบบ

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** `theme-tokens.test.ts`: อ่าน `src/app/globals.css` แยก 3 บล็อก — บล็อกสว่าง (`:root {` บล็อกแรกที่มี `--paper`), บล็อก `[data-theme="dark"]`, บล็อกใน `@media (prefers-color-scheme: dark)` ที่ selector `:root:not([data-theme="light"])` — parse `--<name>: oklch(<L>% <C> <H>);` (รูปแบบนี้ตายตัว) แปลง oklch → sRGB → contrast WCAG (สูตรเดียวกับใน DESIGN §3.1) เทสต์:
  - `it("dark tokens are identical for data-theme and system dark")` สองบล็อกมืดมีชื่อและค่าเท่ากันทุกตัว
  - `it.each` คู่และเกณฑ์จากตาราง contrast ใน DESIGN §3.1 ทั้งสว่างและมืด: ข้อความ ≥ 4.5 (`ink`/`muted`/`accent`/`danger`/`warn` บน `paper` และ `surface`, `on-accent` บน `accent`, `ink` และ `accent` บน `accent-soft`), ขอบ/กราฟิก ≥ 3 (`rule-strong` บน `paper`/`surface`, `chart-1..4` บน `surface`)
- [ ] **Step 2: รัน** `npx vitest run src/app/theme-tokens.test.ts` → FAIL (ไม่พบ `--paper`)
- [ ] **Step 3: เขียน `globals.css`:**
  - token ตามค่าใน DESIGN §3.1 ทุกตัว เขียนเป็น `--paper: oklch(97% 0.008 95);` (L เป็น %) ใน `:root` (สว่าง, `color-scheme: light`), `:root[data-theme="dark"]` และ `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` (มืด, `color-scheme: dark`)
  - `@custom-variant dark` ตาม DESIGN §3.5 ข้อ 4 (แทน media query เดิมที่ใช้ Tailwind ค่าเริ่มต้น)
  - `@theme inline` ผูก `--color-<token>: var(--<token>)`, `--font-sans: var(--font-sarabun), sans-serif`, `--font-display: var(--font-plex-thai), var(--font-sarabun), sans-serif`, `--font-mono: var(--font-geist-mono), ui-monospace, monospace`, `--radius-card: 8px`, `--radius-input: 6px`, `--shadow-card`, `--shadow-cast`, `--shadow-cast-lift` ตาม DESIGN §3.4 (ธีมมืดลด alpha ของเงาลงครึ่งหนึ่งผ่านตัวแปรสีเงา `--shadow-color`)
  - remap ใน `@theme`: `--color-gray-50…950` ใช้ L เดิมของ Tailwind 4 (98.5, 96.7, 92.8, 87.2, 70.7, 55.1, 44.6, 37.3, 27.8, 21, 13 %) chroma 0.006 (ขั้น 50) ไล่ถึง 0.02 (ขั้น 950) hue 100 → 155 · `--color-green-50…950` ใช้ L เดิมของ green ใน Tailwind 4 hue 150 chroma × 0.85 ของค่าเดิม (L ไม่เปลี่ยน contrast ของคลาสเดิมจึงไม่ตก)
  - base: `body` พื้น `var(--paper)` สี `var(--ink)` `line-height: 1.6` (คง padding safe-area เดิม); `h1,h2,h3` `font-family: var(--font-display)` `line-height: 1.25` `letter-spacing: -0.01em` `text-wrap: balance`; `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`; `::selection` ผสม accent 30%; `@media (prefers-reduced-motion: reduce)` ปิด transition/animation/transform ตามแบบ `base.css` ของ Coral
- [ ] **Step 4: ฟอนต์ใน `layout.tsx`:** เพิ่ม `IBM_Plex_Sans_Thai({ variable: "--font-plex-thai", subsets: ["thai", "latin"], weight: ["600", "700"], display: "swap" })` และ `Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "600"], display: "swap" })` ใส่ตัวแปรทั้งสามใน `className` ของ `<html>`
- [ ] **Step 5: รัน** `npx vitest run src/app/theme-tokens.test.ts` → PASS ทุกข้อ
- [ ] **Step 6: Gate** + ภาพ `@shell` (สคริปต์ธีมยังไม่มีจนถึง Task 3 ภาพ `-dark` รอบนี้จึงยังเป็นสว่าง ให้ดูเฉพาะภาพ `-light`) แล้ว commit — `feat: green theme tokens, fonts and dark variant`

---

### Task 3: สลับธีม (สคริปต์ inline + ThemeToggle)

**Files:**
- Create: `src/components/ui/theme.ts`, `src/components/ui/theme.test.ts`, `src/components/ui/theme-toggle.tsx`, `tests/e2e/theme.spec.ts`
- Modify: `src/app/layout.tsx`, `src/app/(public)/layout.tsx`, `src/app/(auth)/layout.tsx`

**Interfaces:**
- Consumes: token จาก Task 2
- Produces:
  - `type ThemeChoice = "light" | "dark" | "system"`
  - `const THEME_STORAGE_KEY = "theme"`
  - `parseThemeChoice(value: string | null): ThemeChoice` (ค่าอื่นนอกจาก `"light"`/`"dark"` = `"system"`)
  - `readThemeChoice(storage: Pick<Storage, "getItem"> | undefined): ThemeChoice` (throw → `"system"`)
  - `applyThemeChoice(choice: ThemeChoice, root: Pick<Element, "setAttribute" | "removeAttribute">, storage: Pick<Storage, "setItem" | "removeItem"> | undefined): void` (`"system"` → `removeAttribute("data-theme")` + `removeItem`; storage throw ถูกกลืน แต่ attribute ยังตั้ง) แล้ว `dispatchEvent(new Event("themechange"))` บน `window` ถ้ามี
  - `const THEME_INIT_SCRIPT: string` (IIFE ในรูปแบบของคู่มือ Next: อ่าน key ตั้ง `data-theme` เฉพาะ `light`/`dark` ห่อ `try/catch`)
  - `<ThemeToggle compact?: boolean className?: string />` จาก `theme-toggle.tsx`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** `theme.test.ts` (fake root/storage เป็น object ธรรมดา):
  - `parseThemeChoice`: `"dark"`→`"dark"`, `"light"`→`"light"`, `null`/`"blue"`/`""`→`"system"`
  - `readThemeChoice` กับ storage ที่ `getItem` throw → `"system"`
  - `applyThemeChoice("dark", …)` → `setAttribute("data-theme","dark")` + `setItem("theme","dark")`; `"system"` → `removeAttribute("data-theme")` + `removeItem("theme")`; storage throw → ไม่ throw และ attribute ยังถูกตั้ง
  - `THEME_INIT_SCRIPT`: รันด้วย `new Function("document","localStorage", THEME_INIT_SCRIPT)` กับ fake — `"dark"` ตั้ง attribute; `"blue"` ไม่ตั้ง; `localStorage.getItem` throw → ไม่ throw
- [ ] **Step 2: รัน** `npx vitest run src/components/ui/theme.test.ts` → FAIL (module not found)
- [ ] **Step 3: เขียน `theme.ts`** ให้ตรง Interfaces (ไฟล์นี้ไม่มี `"use client"` และไม่ import React)
- [ ] **Step 4: รัน** → PASS
- [ ] **Step 5: เขียนเทสต์ e2e ที่ล้ม** `tests/e2e/theme.spec.ts` (รันทั้ง chromium และ mobile-chrome):
  - `"theme choice survives a reload with no flash"`: ไป `/articles` เลือก "มืด" (`getByRole("radio", { name: "มืด" })` หลังเปิด `getByRole("button", { name: "ธีม" })` ถ้าเป็น compact) → `page.addInitScript` ที่เก็บ `document.documentElement.dataset.theme` ตอน `DOMContentLoaded` ไว้ใน `window.__themeAtDcl` → reload → `__themeAtDcl === "dark"` และไม่มี console message ที่มีคำว่า `Hydration` / `hydration`
  - `"no choice follows the system"`: `page.emulateMedia({ colorScheme: "dark" })` ล้าง localStorage → `/` → พื้น `body` (computed) ไม่เท่ากับพื้นตอน `colorScheme: "light"`; เลือก "สว่าง" ขณะระบบมืด → พื้นเท่ากับตอนระบบสว่าง
  - `"ตามระบบ clears the stored choice"`: เลือก "มืด" แล้ว "ตามระบบ" → `localStorage.getItem("theme") === null` และไม่มี `data-theme`
  - `"public pages fit 360 px in both themes"`: viewport 360 × 800 ทั้ง `light`/`dark` บน `/` และ `/articles` → `scrollWidth <= clientWidth` (ใช้ฟังก์ชันแบบ `noSideScroll` ใน `nav.spec.ts`)
- [ ] **Step 6: รัน** `npx playwright test tests/e2e/theme.spec.ts --project=chromium` → FAIL (ไม่มีปุ่ม "ธีม")
- [ ] **Step 7: เขียน `theme-toggle.tsx`** (`"use client"`):
  - state จาก `useSyncExternalStore(subscribe, () => readThemeChoice(safeLocalStorage()), () => "system")` — `subscribe` ฟัง `storage` และ `themechange` บน `window`
  - `useLayoutEffect` ตอน mount ตั้ง/ลบ `data-theme` ตามค่าที่อ่านได้ (ไม่เขียน storage) เพื่อ re-apply หลัง Strict Mode remount ตอน dev ตามคู่มือ Next หัวข้อ "Re-applying attributes in development"
  - แบบเต็ม: `<div role="radiogroup" aria-label="ธีม">` มี `<button role="radio" aria-checked>` 3 ปุ่ม ข้อความ "สว่าง" / "มืด" / "ตามระบบ" สูง 44px พื้น paper-2 ปุ่มที่เลือก surface + `shadow-card`
  - แบบ `compact`: `<button aria-label="ธีม" aria-expanded aria-controls={useId()}>` ไอคอน 44px (SVG inline `aria-hidden`) เปิด panel ที่มี radiogroup เดียวกัน ปิดด้วย Esc, คลิกนอก, หรือหลังเลือก (โฟกัสกลับปุ่ม)
- [ ] **Step 8: ติดตั้ง:** `layout.tsx` — `<html … suppressHydrationWarning>` และ `<head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>`; `(public)/layout.tsx` ใส่ `<ThemeToggle compact />` ต่อท้าย nav ใน header; `(auth)/layout.tsx` ใส่ `<ThemeToggle compact />` มุมขวาบนเหนือการ์ด (ห้ามอ่าน session/cookie ใน layout เหล่านี้)
- [ ] **Step 9: รัน** `npx playwright test tests/e2e/theme.spec.ts` → PASS ทั้งสอง project; `npm run build` แล้วบรรทัดของ `/` และ `/articles` ต้องมีสัญลักษณ์เดียวกับใน `tests/redesign/build-routes.baseline.txt`
- [ ] **Step 10: Gate** + ภาพ `@public` แล้ว commit — `feat: theme switcher (light / dark / system) without flash`

---

### Task 4: ชิ้น UI กลาง

**Files:**
- Create: `src/components/ui/button.tsx`, `card.tsx`, `field.tsx`, `badge.tsx`, `stat.tsx`, `page-header.tsx`, `empty-state.tsx`, `index.ts`, `ui.test.ts`
- Modify: `src/app/_components/activity-ui.tsx` (ให้ `Badge` re-export จาก `@/components/ui`)

**Interfaces:**
- Consumes: utility จาก Task 2
- Produces (ทั้งหมด export จาก `@/components/ui`):
  - `type ButtonVariant = "primary" | "card" | "quiet" | "danger"`; `type ButtonSize = "md" | "lg"`
  - `buttonClass(opts?: { variant?: ButtonVariant; size?: ButtonSize; className?: string }): string` (ค่าเริ่มต้น `card`, `md`)
  - `Button(props: React.ComponentPropsWithRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize })` — **ไม่ใส่ `type` เริ่มต้น**
  - `ButtonLink(props: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize })`
  - `Card(props: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li"; tone?: "default" | "accent" })`
  - `inputClass: string`; `Field(props: { id: string; label: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; className?: string; children: React.ReactNode })` — error เป็น `<p role="alert">`
  - `Badge(props: React.HTMLAttributes<HTMLSpanElement> & { tone?: "gray" | "green" | "amber" | "red" })` (ค่าเริ่มต้น `gray` เหมือนเดิม)
  - `Stat(props: React.HTMLAttributes<HTMLParagraphElement> & { label: React.ReactNode; size?: "md" | "lg" })` — props ที่เหลือ (รวม `data-testid`) ไปที่ `<p>` ตัวเลข
  - `PageHeader(props: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode })` — render `<h1>`
  - `EmptyState(props: React.HTMLAttributes<HTMLDivElement>)`
  - `ThemeToggle` (re-export จาก Task 3)

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** `ui.test.ts` ใช้ `renderToStaticMarkup` + `createElement` (ไฟล์ `.ts`):
  - `Button` ไม่ส่ง `type` → markup ไม่มี ` type=`; ส่ง `type: "submit", "data-testid": "x", "aria-label": "ก", disabled: true` → มีครบ, เป็น `<button`, children `"ยืนยันแลก"` อยู่ใน markup
  - `buttonClass({ variant: "primary", size: "lg" })` มี `bg-accent`, `text-on-accent`, `min-h-12`; ค่าเริ่มต้นมี `min-h-11`
  - `Card({ as: "li", tone: "accent" })` → `<li` + `bg-accent-soft`
  - `Badge` แต่ละ tone มีคลาสสีของตัวเอง (`red` → `text-danger`, `amber` → `text-warn`, `green` → `text-accent`, `gray` → `text-muted`)
  - `Stat({ label: "แต้ม", "data-testid": "points" }, "120")` → `data-testid="points"` อยู่บน element ที่มี `font-mono` และมีข้อความ `120`
  - `Field({ id: "f1", label: "อีเมล", error: "ผิด" }, input)` → `<label for="f1"` และ `role="alert"`
  - `PageHeader({ title: "ตรวจผล" })` → `<h1`
- [ ] **Step 2: รัน** `npx vitest run src/components/ui/ui.test.ts` → FAIL
- [ ] **Step 3: เขียนชิ้นทั้งหมด** ตามสเปกหน้าตาใน DESIGN §4 (คลาสต่อ `className` ของผู้เรียกไว้ท้ายสุด, ไม่มี `id` ตายตัว, ไม่มีข้อความในตัว) · `primary` hover `-translate-y-px` + `shadow-cast-lift`, active `translate-y-px`, transition `duration-[var(--dur-short)] ease-[var(--ease-out)]`, `motion-reduce:transform-none` · `activity-ui.tsx` ลบ `Badge` เดิมแล้ว `export { Badge } from "@/components/ui"` (import เดิมทุกไฟล์ใช้ต่อได้)
- [ ] **Step 4: รัน** → PASS; `npm test` ทั้งชุดผ่าน
- [ ] **Step 5: Gate** แล้ว commit — `feat: shared UI primitives`

---

### Task 5: โครงหน้าและเมนู

**Files:**
- Modify: `src/app/(student)/layout.tsx`, `src/app/(student)/_components/student-nav.tsx`, `src/app/staff/layout.tsx`, `src/app/staff/_components/staff-nav.tsx`, `src/components/NotificationBell.tsx` (เฉพาะคลาส), `src/app/_components/page-skeleton.tsx`, `src/app/_components/error-view.tsx`, `src/app/_components/sign-out-button.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/staff/error.tsx`, `src/app/(public)/layout.tsx`, `src/app/(auth)/layout.tsx`

**Interfaces:**
- Consumes: `ThemeToggle`, `buttonClass`, `Button`, token

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** เพิ่มใน `tests/e2e/theme.spec.ts`:
  - `"student desktop header has the theme control"` (chromium): ล็อกอิน student → `/dashboard` → `getByRole("button", { name: "ธีม" })` มองเห็นได้ใน `<header>`
  - `"staff sidebar has the theme control"` (chromium, viewport 1280 = `xl`): ล็อกอิน teacher → `/staff` → `getByRole("radiogroup", { name: "ธีม" })` มองเห็นได้ (ตัวในลิ้นชักซ่อนอยู่ที่ขนาดนี้)
- [ ] **Step 2: รัน** → FAIL
- [ ] **Step 3: ทำตาม DESIGN §4 "จุดอื่น" และ §3.4:** ช่องว่างข้างจอของเนื้อหา `px-4 md:px-6 xl:px-10`; หัวนักเรียน (wordmark `font-display` สี accent, เมนูหน้าปัจจุบันขีดเส้นใต้ accent 2px, ขวาเป็นกระดิ่ง + `ThemeToggle compact` ใน `hidden md:flex`), เมนูล่าง (surface, ขอบบน rule, pill accent-soft หลังไอคอนที่เลือก, คง `h-14`/safe-area/`data-bottom-nav`), แถบข้างและลิ้นชักครู (พื้น paper-2, รายการที่เลือก accent-soft + `border-l-[3px] border-accent`, `ThemeToggle` แบบเต็มต่อท้ายใน `StaffSidebar` และ `StaffDrawer` นอก `<nav>` และนอก `<Suspense>` ของ `StaffNav`), กระดิ่ง (pill `bg-danger text-on-accent font-mono`), skeleton (`bg-paper-2` + `motion-safe:animate-pulse`), error view (`h1` `font-display` + `Button variant="quiet"`) · ห้ามแตะ logic โฟกัส/Esc/ปิดเมื่อเปลี่ยนหน้าใน `staff-nav.tsx`
- [ ] **Step 4: รัน** `npx playwright test tests/e2e/theme.spec.ts tests/e2e/nav.spec.ts tests/e2e/notifications.spec.ts` → PASS
- [ ] **Step 5: Gate** + ภาพ `@shell` แล้ว commit — `feat: redesign app shell and navigation`

---

### Task 6: หน้าสาธารณะและหน้า auth

**Files:**
- Modify: `src/app/page.tsx`, `src/app/(public)/articles/page.tsx`, `src/app/(public)/articles/[slug]/page.tsx`, `src/app/(public)/articles/[slug]/not-found.tsx`, `src/app/(public)/article-not-found/page.tsx`, `src/app/(public)/article-not-found/not-found.tsx`, `src/app/(auth)/_components/ui.tsx`, `src/app/(auth)/*/[a-z-]*-form.tsx` (4 ไฟล์), `src/app/(auth)/*/page.tsx` (4 ไฟล์)

**Interfaces:**
- Consumes: `ButtonLink`, `Button`, `buttonClass`, `Card`, `Stat`, `Field`, `inputClass`, `PageHeader`, `EmptyState`

- [ ] **Step 1:** หน้าแรกตาม DESIGN §5 (hero `font-display` ขนาด `text-[clamp(2.25rem,4vw+1rem,3.75rem)]`, `PublicTotals` แสดงเป็น `Stat` 3 การ์ด + การ์ด "บันทึกภาคสนาม" `lg:` ด้านขวา, ระยะระหว่าง section `py-18 lg:py-30` = 72/120px ตาม §3.4) **ห้ามย้าย `PublicTotals` ออกจาก `<Suspense>` และห้ามแตะฟังก์ชันที่ดึงข้อมูล** — แก้เฉพาะ JSX/คลาส ลิงก์เดิมใช้ `buttonClass` (ยังเป็น `<Link>`)
- [ ] **Step 2:** บทความตาม DESIGN §5 (`max-w-[65ch]`, ปก `rounded-card`, รายการเป็น `Card as="article"`), หน้า not-found ตาม §4
- [ ] **Step 3:** auth: การ์ดใน `(auth)/layout.tsx` เป็น `Card`, ช่องกรอกใน `ui.tsx` ใช้ `inputClass`, ปุ่มใช้ `buttonClass({ variant: "primary", size: "lg" })` (คง `type` และข้อความเดิม), error คง `role="alert"`
- [ ] **Step 4: รัน** `npx playwright test tests/e2e/articles.spec.ts tests/e2e/theme.spec.ts` และ `node tests/redesign/check-scope.mjs` → PASS / `scope OK`
- [ ] **Step 5: Gate** (ตรวจ log build ว่า `/` และ `/articles` ยังใช้สัญลักษณ์ prerender เดิม) + ภาพ `@public` แล้ว commit — `feat: redesign public and auth pages`

---

### Task 7: หน้านักเรียน ชุด A (dashboard, กิจกรรม, ส่งผล, อันดับ)

**Files:**
- Modify: `src/app/(student)/dashboard/page.tsx`, `dashboard/_components/student-stats.tsx` (เฉพาะ JSX/คลาส ห้ามแตะ query บรรทัด 28–64), `dashboard/_components/rank-card.tsx`, `src/app/(student)/activities/page.tsx`, `activities/[id]/page.tsx`, `activities/[id]/join-button.tsx`, `activities/[id]/submit/page.tsx`, `activities/[id]/submit/submit-form.tsx`, `src/app/(student)/my-submissions/page.tsx`, `src/app/(student)/leaderboard/page.tsx`, `src/app/_components/activity-ui.tsx`

**Interfaces:**
- Consumes: `Card`, `Stat`, `Badge`, `Button`, `ButtonLink`, `Field`, `inputClass`, `PageHeader`, `EmptyState`

- [ ] **Step 1:** dashboard ตาม DESIGN §5 (การ์ด `tone="accent"` แต้ม + carbon เป็น `Stat size="lg"` ย้าย `data-testid` เดิมไปที่ props ของ `Stat` ถ้าเดิมอยู่บนตัวเลข)
- [ ] **Step 2:** ฟอร์มส่งผลตาม DESIGN §5 (4 กลุ่มเป็น `Card`, ช่อง kg + ขีด `grid-cols-2`, กล่องรูปขอบประ `border-dashed border-rule-strong`, รหัส `font-mono tracking-[0.3em]`, ปุ่มส่ง `primary lg w-full sm:w-auto`) — `useId()`, การรีเซ็ตหลังส่ง และ `type` ของปุ่มคงเดิม
- [ ] **Step 3:** รายการกิจกรรม / ผลที่ส่ง / อันดับ เป็น `Card` + `Badge` + `EmptyState` (ข้อความว่างเดิม); ตัวเลขอันดับและแต้ม `font-mono`; แถวของตัวเองบนหน้าอันดับพื้น accent-soft
- [ ] **Step 4: รัน** `npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/activities.spec.ts tests/e2e/submit.spec.ts tests/e2e/leaderboard.spec.ts tests/e2e/preserved-forms.spec.ts` → PASS
- [ ] **Step 5: Gate** + ภาพ `@student` แล้ว commit — `feat: redesign student dashboard, activities and submissions`

---

### Task 8: หน้านักเรียน ชุด B (รางวัล, cart, ออเดอร์, แจ้งเตือน, โปรไฟล์)

**Files:**
- Modify: `src/app/(student)/rewards/page.tsx`, `rewards/add-to-cart-button.tsx`, `src/app/(student)/cart/page.tsx`, `cart/cart-line.tsx`, `cart/checkout-button.tsx`, `src/app/(student)/orders/page.tsx`, `orders/[id]/page.tsx`, `src/app/(student)/notifications/page.tsx`, `src/app/(student)/profile/page.tsx`, `src/app/_components/account-sections.tsx`, `profile-form.tsx`, `notification-list.tsx`, `reward-image.tsx`

**Interfaces:**
- Consumes: ชิ้นจาก Task 4 + `ThemeToggle`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** เพิ่มใน `tests/e2e/theme.spec.ts`: `"student can switch theme on ฉัน"` (mobile-chrome): ล็อกอิน student → `/profile` → `getByRole("radiogroup", { name: "ธีม" })` มองเห็นได้ → เลือก "มืด" → `<html data-theme="dark">`
- [ ] **Step 2: รัน** → FAIL
- [ ] **Step 3:** ตาม DESIGN §5: grid ของรางวัล (`Card`, รูป `aspect-[4/3] object-cover` ยังเป็น `<img>` คง eslint-disable เดิม, แต้ม `font-mono`), cart/ออเดอร์ (`Badge` สถานะ, ยอดรวม `font-mono`), รายการแจ้งเตือน (คง `data-realtime`) · หน้าโปรไฟล์เพิ่ม section "ธีม" ที่มี `<ThemeToggle />` แบบเต็ม (หัวข้อ section ใช้ข้อความ "ธีม" ที่อยู่ใน allowlist)
- [ ] **Step 4: รัน** `npx playwright test tests/e2e/theme.spec.ts tests/e2e/cart.spec.ts tests/e2e/checkout.spec.ts tests/e2e/receipt.spec.ts tests/e2e/reward-stock.spec.ts tests/e2e/notifications.spec.ts tests/e2e/profile.spec.ts` → PASS
- [ ] **Step 5: Gate** + ภาพ `@student` แล้ว commit — `feat: redesign rewards, orders, notifications and profile`

---

### Task 9: หน้าครู ชุด A (หน้าหลัก, ตรวจผล, จุดชั่ง, ออเดอร์)

**Files:**
- Create: `src/app/staff/weigh-station/_components/countdown-tone.ts`, `countdown-tone.test.ts`
- Modify: `src/app/staff/page.tsx`, `staff/_components/staff-stats.tsx`, `staff/reviews/page.tsx`, `staff/reviews/[id]/page.tsx`, `staff/reviews/_components/review-actions.tsx`, `staff/weigh-station/page.tsx`, `staff/weigh-station/_components/weigh-station.tsx`, `staff/orders/page.tsx`, `staff/orders/_components/order-actions.tsx`, `staff/orders/_components/expire-button.tsx`

**Interfaces:**
- Produces: `type CountdownTone = "normal" | "warn" | "danger"`; `countdownTone(remainingMs: number): CountdownTone` — `remainingMs <= 0` → `"danger"`, `<= 300_000` → `"warn"`, อื่น ๆ → `"normal"`

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** `countdown-tone.test.ts`: `countdownTone(1_800_000)` = `"normal"`, `300_001` = `"normal"`, `300_000` = `"warn"`, `1` = `"warn"`, `0` = `"danger"`, `-5` = `"danger"`
- [ ] **Step 2: รัน** → FAIL
- [ ] **Step 3: เขียน `countdown-tone.ts`** → รัน → PASS
- [ ] **Step 4: จุดชั่งตาม DESIGN §5:** รหัสบนการ์ด `tone="accent"` `border-2 border-accent` `font-mono text-6xl sm:text-7xl`; `<p role="timer">` ใช้ `countdownTone(remaining)` เลือก `text-ink` / `text-warn` / `text-danger` (ใช้ตัวแปร `remaining` ที่คอมโพเนนต์คำนวณอยู่แล้ว ไม่เพิ่ม state/effect); `<select>`/`<input>` ใช้ `inputClass` + `min-h-12`; ปุ่ม `size="lg"`; error คง `role="alert"`/`role="status"`
- [ ] **Step 5:** หน้าหลัก staff (`Stat` + `Card`), ตรวจผล (รายการ `Card`, รายละเอียดรูปใหญ่ `rounded-card`, ตารางตาม §4, อนุมัติ `primary` ปฏิเสธ `danger`), ออเดอร์ (ตารางใน `overflow-x-auto`, `Badge` สถานะ)
- [ ] **Step 6: เขียนเทสต์ที่ล้ม→ผ่าน** เพิ่มใน `theme.spec.ts`: `"staff orders fit 360 px in both themes"` — ล็อกอิน teacher viewport 360 → `/staff/orders` ทั้ง `light`/`dark` → `scrollWidth <= clientWidth`
- [ ] **Step 7: รัน** `npx playwright test tests/e2e/review.spec.ts tests/e2e/weigh-station.spec.ts tests/e2e/checkout.spec.ts tests/e2e/theme.spec.ts tests/e2e/full-flow.spec.ts` → PASS
- [ ] **Step 8: Gate** + ภาพ `@staff` แล้ว commit — `feat: redesign staff home, reviews, weigh station and orders`

---

### Task 10: หน้าครู ชุด B (กิจกรรม, ของรางวัล, บทความ, ผู้ใช้, อัตรา, รายงาน, บัญชี)

**Files:**
- Modify: `src/app/staff/activities/**` (`page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`, `_components/activity-form.tsx`, `_components/delete-activity-button.tsx`), `src/app/staff/rewards/**` (`page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`, `_components/reward-form.tsx`, `active-toggle.tsx`, `delete-reward-button.tsx`), `src/app/staff/articles/**` (`page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`, `_components/article-form.tsx`, `publish-toggle.tsx`, `delete-article-button.tsx`), `src/app/staff/users/page.tsx`, `users/[id]/page.tsx`, `users/_components/adjust-form.tsx`, `role-form.tsx`, `src/app/staff/rates/page.tsx`, `rates/_components/rate-form.tsx`, `src/app/staff/reports/page.tsx`, `src/app/staff/notifications/page.tsx`, `src/app/staff/profile/page.tsx`

**Interfaces:**
- Consumes: ชิ้นจาก Task 4

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** เพิ่มใน `theme.spec.ts`: `"staff reports fit 360 px in both themes"` — ล็อกอิน admin viewport 360 → `/staff/reports` ทั้งสองธีม → `scrollWidth <= clientWidth`
- [ ] **Step 2: รัน** → ผ่านหรือล้มก็ได้ (เป็น regression guard) จดผลไว้
- [ ] **Step 3:** ฟอร์มทั้งหมดใช้ `Field`/`inputClass` (คง `useId()`, การรีเซ็ต, `type` ปุ่ม), ปุ่มลบ `danger`, toggle เป็น `Button variant="card"`, ตารางตาม §4 ใน `overflow-x-auto`, รายงานตาม DESIGN §5 (ตัวกรองวันที่ `flex flex-wrap`, ปุ่ม CSV/PDF `card`)
- [ ] **Step 4: รัน** `npx playwright test tests/e2e/admin.spec.ts tests/e2e/reward-form.spec.ts tests/e2e/reports.spec.ts tests/e2e/articles.spec.ts tests/e2e/activities.spec.ts tests/e2e/preserved-forms.spec.ts tests/e2e/theme.spec.ts` → PASS
- [ ] **Step 5: Gate** + ภาพ `@staff` แล้ว commit — `feat: redesign staff management pages and reports`

---

### Task 11: กราฟ

**Files:**
- Modify: `src/components/charts/WasteByCategory.tsx`

**Interfaces:**
- Consumes: `--chart-1`…`--chart-4`, `--muted`, `--rule`, `--surface` จาก Task 2 (ค่าตรวจ contrast แล้วใน `theme-tokens.test.ts`)

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** เพิ่มใน `tests/e2e/dashboard.spec.ts` ในเทสต์ที่มีกราฟอยู่แล้ว (มีผลอนุมัติ): ใน `getByTestId("waste-chart")` ทุก `path.recharts-rectangle` มี `fill` ขึ้นต้นด้วย `var(--chart-` และไม่มี `#16a34a`
- [ ] **Step 2: รัน** → FAIL
- [ ] **Step 3:** ใช้ `<Cell key={i} fill={`var(--chart-${(i % 4) + 1})`} />` ใน `<Bar>` ตามลำดับแท่ง (DESIGN §4 — ไม่แตะ query ของ dashboard), `CartesianGrid stroke="var(--rule)"`, `tick={{ fontSize: 12, fill: "var(--muted)" }}` ทั้งสองแกน, axis line `stroke="var(--rule)"`, `LabelList fill="var(--ink)"` · ตอนนี้ไม่มี `<Tooltip>` จึงไม่ต้องเพิ่ม (ข้อ tooltip ใน DESIGN §4 ใช้เมื่อมีเท่านั้น) · ตาราง `sr-only` และ `data-testid` คงเดิม
- [ ] **Step 4: รัน** `npx playwright test tests/e2e/dashboard.spec.ts` → PASS
- [ ] **Step 5: Gate** + ภาพ `/dashboard` ของนักเรียนที่มีผล (`@student`) แล้ว commit — `feat: theme-aware waste chart`

---

### Task 12: เก็บงานและส่งมอบ

**Files:**
- Modify: `docs/DESIGN.md` (สถานะ), ไฟล์ใน `src/app/**` ที่ยังเหลือคลาสดิบโดยไม่มีเหตุผล

- [ ] **Step 1:** `grep -rnoE "\b(bg|text|border|ring|divide)-(gray|green)-[0-9]{2,3}" src --include=*.tsx` แต่ละจุดที่เหลือ: แทนด้วย token หรือเขียนเหตุผลสั้นในตารางท้าย DESIGN §3.2 (เป้า ≤ 20 จุด) · `dark:` ที่ซ้ำกับ token (เช่น `bg-white dark:bg-gray-950` บนพื้นที่ใช้ `bg-surface` ได้) ลบออก
- [ ] **Step 2:** ตรวจด้วยมือในเบราว์เซอร์ที่ 360 px ทั้งสองธีม: Tab ผ่านทุกหน้า `@public` และ `/dashboard` เห็น focus ring ทุกจุด; เปิด "ลดการเคลื่อนไหว" ใน DevTools (Rendering → `prefers-reduced-motion`) แล้วปุ่มไม่ยก skeleton ไม่กระพริบ
- [ ] **Step 3:** อัปเดตหัว `docs/DESIGN.md` เป็น `สถานะ: **ใช้งานแล้ว** บน branch redesign` และบันทึกสัญลักษณ์ build ของ `/` และ `/articles`
- [ ] **Step 4: Gate** + ภาพครบทุกกลุ่ม แล้ว commit — `docs: redesign complete`
- [ ] **Step 5:** รีวิวรวมทั้ง branch (superpowers:requesting-code-review) เทียบกับ DESIGN §1 ทุกข้อ แล้วใช้ superpowers:finishing-a-development-branch (ห้าม merge เข้า `main` เองโดยไม่ถามเจ้าของโปรเจกต์)
