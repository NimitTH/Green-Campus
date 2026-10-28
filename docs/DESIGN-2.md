# Green Campus: Design system แบบที่สอง ("สมุดบันทึกภาคสนาม จัดเต็ม")

> สถานะ: spec รอเจ้าของตรวจ · branch `redesign-2` (แตกจาก `redesign` ที่ 7a83b48) · brainstorming 28 ต.ค. 2026
> แบบที่หนึ่งอยู่ใน `docs/DESIGN.md` และ branch `redesign` (PR เดิม) **ห้ามแก้ทั้งคู่**
> mockup ที่เจ้าของผ่านแล้ว: `.superpowers/brainstorm/10-1793165009/content/home-v5.html` (ไม่ได้ commit, gitignored)

---

## 1. ข้อห้ามและข้อจำกัด

ทุกข้อใน `docs/DESIGN.md` §1 ยังใช้ ยกเว้นที่เขียนไว้ใน §1.2 และ §1.3 ของไฟล์นี้

### 1.1 ยังห้ามเหมือนเดิม

- ห้ามเปลี่ยนข้อความปุ่ม ป้าย ชื่อเมนู ที่มีอยู่แล้ว ห้ามเปลี่ยน `data-testid` และข้อความ aria เดิม
- ห้ามแตะ logic/SQL เดิม พาธต้องห้าม: `supabase/migrations` (ไฟล์เดิม), `supabase/tests` (ไฟล์เดิม), `src/app/actions`, `src/lib` (ไฟล์เดิม), `src/proxy.ts`, `src/app/api`, `scripts`
- ห้ามเพิ่ม dependency, ห้าม `npm --force` / `--legacy-peer-deps`
- `/` และ `/articles` ต้องเป็น static (○) หลัง build, ห้ามอ่าน cookie ในส่วนที่ cache
- ทุกกลุ่มหน้ารัน gate เต็มตาม HANDOFF §9 ก่อน commit
- ห้าม stage/commit ไฟล์ที่ค้างอยู่ก่อน: `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`, `.agents/`, `.claude/`, `skills-lock.json`
- ห้าม merge หรือ push จนกว่าเจ้าของสั่ง
- ถ้าคำแนะนำของสกิล (Impeccable, vercel-labs) ขัดกับ `node_modules/next/dist/docs/` หรือไฟล์นี้ ให้ยึดไฟล์นี้และเอกสาร Next

### 1.2 ข้อความใหม่ที่อนุญาต (เฉพาะที่ระบุ)

- เนื้อหาหน้าแรก `/` ตาม §5 (ข้อความทุกคำในตาราง §5.3)
- หัวคอลัมน์ footer "เริ่มต้น", "อ่าน" และชื่อแพลตฟอร์มโซเชียล (Facebook, YouTube, Instagram, X, LINE) เป็น aria-label
- ปุ่มธีมใช้ชื่อ aria "ธีม" (มีใน allowlist แล้ว) ข้อความ "สว่าง", "มืด", "ตามระบบ" ของปุ่มธีมแบบเดิมถูกเอาออกได้ (เป็นข้อความที่แบบแรกเพิ่มเอง)
- `tests/redesign/check-scope.mjs` ต้องรู้จักข้อความใหม่เหล่านี้: ให้ baseline ข้อความใหม่เป็นไฟล์แยก `tests/redesign/ui-strings-2.allow.txt` และข้อความเดิมทุกตัวใน baseline ยังต้องอยู่ครบ (ยกเว้น สว่าง/มืด/ตามระบบ)

### 1.3 ข้อยกเว้นฐานข้อมูล (เพิ่มอย่างเดียว เจ้าของอนุมัติ 28 ต.ค. 2026)

อนุญาตเฉพาะไฟล์ใหม่ 3 ไฟล์นี้ (และ test ของ lib):

- `supabase/migrations/0026_public_home_feed.sql`
- `supabase/tests/public_home_feed.test.sql`
- `src/lib/home/public-feed.ts` (+ `src/lib/home/public-feed.test.ts`)

check-scope อนุญาตด้วยชื่อไฟล์ตรงตัวเท่านั้น ไฟล์อื่นในพาธต้องห้ามยังห้าม · `use-cache-count` ใน baseline เปลี่ยนจาก 5 เป็น 7 · RLS ของตารางเดิมห้ามแตะ · ไม่มีการล้าง cache จาก action (action ห้ามแตะ) ข้อมูลกิจกรรม/รางวัลบนหน้าแรกจึงสดภายใน `cacheLife("minutes")`

---

## 2. ทิศทางการออกแบบ

**อารมณ์: "สมุดบันทึกภาคสนาม จัดเต็ม"** ต่อยอดแบบแรก แต่เอาของที่แบบแรกตัดออกกลับมา: ลายผิวกระดาษ, เงาพิมพ์นูนหลายชั้น, หัวข้อใหญ่หนาแน่น, ฉาก/รูปวาดด้วย CSS-SVG และเพิ่มลูกเล่นสมุดบันทึก (เทป, คลิปหนีบ, หมุด, ตราประทับ, ไฮไลต์ปากกา, รอยแก้วกาแฟ, ลูกศรวาดมือ, ขอบกระดาษฉีก)

**โครงหน้าแรก** ยืมจาก v0-compute (หัวข้อมีเลข 01..07, ขั้นตอนเรียงแถว, แผงตัวเลขสด, CTA ปิดท้าย, footer หลายคอลัมน์) แต่ผิวเป็นกระดาษ ไม่ใช่ธีมมืดเรืองแสง

**Impeccable** (`.claude/skills/impeccable`, ติดตั้งแล้ว ไม่ commit): ใช้แบบ "launcher unavailable" คืออ่านไฟล์ markdown ไม่รันไบนารี
- ก่อนแก้ UI ทุกครั้งอ่าน `reference/craft-floor.md`
- ปิดแต่ละกลุ่มหน้าตรวจตาม `reference/audit.md` และ `reference/polish.md`
- โหมด: หน้าแรก = Persuade (จัดเต็ม); หน้านักศึกษา/เจ้าหน้าที่ = Operate (ความแม่นยำและความคุ้นเคยมาก่อน ลูกเล่นเบา); `/articles` = Read
- ห้ามหน้าแรกเป็น template "หัวข้อซ้าย การ์ดขวา + การ์ดเท่ากันเป็นแถว"

**ระดับลูกเล่นตามโหมด**

| ลูกเล่น | หน้าแรก | สาธารณะ/auth | นักศึกษา/เจ้าหน้าที่ |
|---|---|---|---|
| ลายผิวกระดาษ (grain) | ✓ | ✓ | ✓ (พื้นหลังเท่านั้น) |
| เงาพิมพ์นูนหลายชั้น (ปุ่มหลัก, การ์ด) | ✓ | ✓ | ✓ |
| การ์ดเอียง → ตั้งตรงเมื่อ hover | ✓ | การ์ดบทความ | ไม่ใช้ (ตารางและฟอร์มต้องตรง) |
| เทป / คลิป / หมุด | ✓ | การ์ดบทความ, การ์ด auth | หัวการ์ดสรุปเท่านั้น (เช่น dashboard stat) |
| ตราประทับ, ใบไม้ร่วง, รอยกาแฟ, ลูกศรวาดมือ | ✓ | – | – |
| ไฮไลต์ปากกา | หัวข้อ hero | หัวข้อหน้า | – |
| ขอบกระดาษฉีก | ระหว่าง section | – | – |

---

## 3. Token

### 3.1 สี

token ของแบบแรก (`globals.css`) คงเดิมทั้งหมด เพิ่ม token ใหม่ต่อไปนี้ (ค่าตั้งต้นจาก mockup; implementer ปรับ L ได้เพื่อผ่าน AA ทุกคู่ที่ใช้จริง และต้องมี test contrast)

| token | ใช้กับ | สว่าง (เริ่ม) | มืด (เริ่ม) |
|---|---|---|---|
| `--paper-3` | พื้นกระดาษกราฟ (03) | `#e8efdf` | `#14211a` |
| `--kraft` | พื้น 05 กิจกรรม (ล่าง) | `#ecdcc6` | `#2b2419` |
| `--kraft-2` | พื้น 05 กิจกรรม (บน) | `#f4eadc` | `#221d15` |
| `--sun` | ดวงอาทิตย์, ปลายแถบไล่สี | `#f0c25a` | `#e2b54e` |
| `--sea` | ทะเลในรูปโลก | `#9cc9c0` | `#3d6b63` |
| `--accent-deep` | เงาพิมพ์นูนของปุ่มหลัก | `#1d5a28` | `#4fae63` |
| `--margin` | เส้นกั้นหน้ากระดาษ | accent 45% | accent 35% |
| `--line` | เส้นบรรทัด/เส้นกราฟ | accent 12% | accent 8% |

ข้อความบนพื้น `--kraft`, `--kraft-2`, `--paper-3`, CTA ไล่สี ต้องผ่าน AA (4.5:1 ตัวปกติ, 3:1 ตัวใหญ่) ทั้งสองธีม · ธีมมืดยังเป็น "ป่าตอนกลางคืน" ตามแบบแรก

### 3.2 ไล่สี (ใช้เฉพาะจุดที่ระบุ ที่เหลือสีเรียบ)

- เลขขั้นตอน 01–04: ไล่ `--accent` → accent 30% บน paper (background-clip:text)
- แถบความคืบหน้ากิจกรรม: `--sun`/accent ผสม → `--accent` → `--accent-deep` + ลายเฉียงขาวจาง
- พื้น 05: `--kraft-2` → `--kraft` (บนลงล่าง)
- พื้น CTA: ไล่เฉียง accent 26% บน paper → `--accent-soft` → `--sun` 18% บน paper + รูปใบไม้จาง 2 ใบ
- รูปของรางวัลที่ไม่มีรูป: 4 คู่ไล่สีวนตามลำดับ (เขียวอ่อน, เหลือง, ฟ้าทะเล, คราฟท์) ธีมมืดลด saturate/brightness
- ปุ่มยังเป็นสีเรียบ (เงาพิมพ์นูนคือเอกลักษณ์)

### 3.3 พื้นผิวกระดาษ

- grain: SVG `feTurbulence` เป็น data URI ใน CSS (ไม่มีไฟล์รูป) วางบน `body` เป็น background-image ความทึบต่ำ ธีมมืดใช้ค่าเดียวกันได้ถ้ายังไม่เห็นเป็นจุด
- พื้นแบบต่างๆ เป็น utility class ใน `@layer components`: `paper-ruled` (เส้นบรรทัด), `paper-dots` (จุด), `paper-grid` (กราฟ), `paper-kraft`, `paper-torn` (ขอบฉีกด้านบนด้วย clip-path)

### 3.4 ฟอนต์, ระยะ, เงา, การเคลื่อนไหว

- ฟอนต์เดิม (Sarabun / IBM Plex Sans Thai / Geist Mono ตัวเลขเท่านั้น)
- หัวข้อ hero `clamp(2.5rem, 5.6vw, 4.75rem)`, `line-height` ≥ 1.12 (วรรณยุกต์ไทยห้ามชน), tracking -0.025em; หัวข้อ section `clamp(1.75rem, 3.4vw, 2.75rem)`, line-height ≥ 1.2
- container หน้าแรก: `max-w-[70rem]` (1120px) กลางจอ, gutter 24px (มือถือ 16px)
- เงาพิมพ์นูน: ปุ่มหลัก `1px 1px 0, 2px 2px 0, 3px 3px 0` สี `--accent-deep` + เงาตกนุ่ม; ปุ่มรอง/การ์ดใช้ `--rule`
- easing `--ease-out` เดิม; การ์ด hover 400ms; ปุ่ม hover ยก 1px
- `prefers-reduced-motion: reduce`: ปิด animation ทุกตัว (ใบไม้ร่วง, ไฮไลต์ลาก, จุดกะพริบ), การ์ดไม่เอียง/ไม่ขยับ, ไฮไลต์แสดงเต็มทันที (กฎ translate/scale/rotate ของแบบแรกยังอยู่)

---

## 4. Component

แก้ใน `src/components/ui/` เดิม (API เดิมต้องใช้ได้ ไม่ทำให้หน้าที่เรียกอยู่พัง)

- **ThemeToggle → ปุ่มไอคอน** `ThemeToggle({ className? })`
  - ปุ่มเดียว 44×44 `aria-label="ธีม"` `aria-pressed` = ธีมที่แสดงอยู่เป็นมืดหรือไม่, ไอคอนดวงอาทิตย์ (สว่าง) / พระจันทร์ (มืด) เป็น SVG inline `aria-hidden`
  - ค่าเริ่มต้น "ตามระบบ" (ไม่มีค่าใน localStorage → ไม่มี `data-theme`) · กด: ถ้าตอนนี้แสดงมืด → เก็บ `light`, ถ้าสว่าง → เก็บ `dark` · หลังกดแล้วไม่มีทางกลับเป็น "ตามระบบ" จากปุ่ม (เจ้าของรับทราบ)
  - script กันกะพริบ (`THEME_INIT_SCRIPT`), `THEME_STORAGE_KEY`, `parseThemeChoice` คงเดิม; `useSyncExternalStore` ยังใช้ snapshot ฝั่ง server = "system" และไอคอนก่อน hydrate ต้องไม่ทำให้ hydration mismatch (เรนเดอร์ทั้งสองไอคอนแล้วซ่อนด้วย CSS ตาม `data-theme`/media query หรือวิธีที่ไม่ mismatch)
  - prop `compact` เดิมถูกเอาออก (ทุกที่ใช้ปุ่มไอคอน) ผู้เรียกทุกตัวต้องแก้ตาม
- **Button / ButtonLink**: เพิ่มเงาพิมพ์นูนหลายชั้นใน variant primary/secondary; ขนาด sm/md/lg และ `translate-none` ใต้ reduced motion คงเดิม
- **Card**: เพิ่ม prop `deco?: "tape" | "clip" | "pin"` (ของตกแต่ง `aria-hidden`) และ `tilt?: boolean` (เอียงสลับ ±1° ตั้งตรงเมื่อ hover; reduced motion ไม่เอียง) · `flush`, `tone` คงเดิม
- **SiteHeader (ใหม่, `src/app/_components/site-header.tsx`)**: เมนูบนของหน้าสาธารณะ/auth/หน้าแรก `sticky top-0` พื้นโปร่งเบลอ, ลำดับ: โลโก้ใบไม้ + "Green Campus" · ไอคอนธีม · บทความ · เข้าสู่ระบบ · สมัครสมาชิก (ปุ่มหลัก) · มือถือซ่อนลิงก์ "บทความ" · ใช้แทน header เดิมของ `/` และ `(public)`/`(auth)` layout โดยข้อความและลิงก์เดิมไม่เปลี่ยน
- **SiteFooter (ใหม่, `src/app/_components/site-footer.tsx`)**: ไม่มีเส้นขอบบน, พื้นกระดาษเรียบ, คอลัมน์: โลโก้ใบไม้ + "Green Campus" + "ระบบจัดการขยะในวิทยาลัย" + ที่มา carbon + ไอคอนโซเชียล · "เริ่มต้น" (สมัครสมาชิก, เข้าสู่ระบบ) · "อ่าน" (บทความ)
- **social-links (ใหม่, `src/app/_components/social-links.ts`)**: `SOCIAL_LINKS: { platform: "facebook"|"youtube"|"instagram"|"x"|"line"; label: string; href: string }[]` ค่า `href: ""` ทั้งหมดรอเจ้าของใส่ · ฟังก์ชัน `visibleSocialLinks()` คืนเฉพาะที่ href ไม่ว่าง (มี unit test) · ไอคอน SVG inline 44×44, `target="_blank" rel="noopener noreferrer"`
- **แถบเมนูของนักศึกษา/เจ้าหน้าที่**: ใช้ ThemeToggle แบบไอคอนแทนแบบเดิม ตำแหน่งเดิม (sidebar เจ้าหน้าที่ยังอยู่ล่างสุด), sidebar กว้างเดิม

---

## 5. หน้าแรก `/`

### 5.1 โครง (ตาม mockup รอบ 5)

| # | ส่วน | พื้น | เนื้อหา |
|---|---|---|---|
| – | SiteHeader | โปร่งเบลอ | §4 |
| hero | หน้าสมุด | `paper-ruled` + รูเจาะ + เส้นกั้นหน้า | kicker "ระบบจัดการขยะในวิทยาลัย" (ข้อความเดิม) · h1 · lede · ปุ่มหลัก → `/activities` · ปุ่มรอง "บทความ" → `/articles` · แถวบัญชี 3 ตัวเลขจาก `getPublicStats()` (label/หน่วยเดิม, `data-testid` `stat-*` เดิม) · "อัปเดตทุก 1 นาที" · ขวา: โพลารอยด์โลก+ต้นไม้ (SVG inline `aria-hidden`), เทป, ตราประทับวงกลม, ลูกศรวาดมือ, ใบไม้ร่วง 3 ใบ · มือถือ: รูปขึ้นบน กว้าง ≤300px |
| 01 | ปัญหา | `paper-dots` + ขอบฉีก | h2 + ย่อหน้า · การ์ดแปะเทป + รอยกาแฟ: 3.5 กก. CO2e + ที่มา |
| 02 | ทำอะไร | paper | h2 "แยก. ชั่ง. สะสม. แลก." · 4 ขั้นตอน เลขไล่สี · ลูกศรวาดมือระหว่างขั้น (ซ่อนบนมือถือ, มือถือ 2×2) |
| 03 | ทำเพื่อใคร | `paper-grid` + ขอบฉีก | หน้าสมุดนักศึกษา (คลิปหนีบ) + โน้ตแปะ 2 แผ่น (เอียง) |
| 04 | รู้ไว้ | paper | 3 ช่อง: กระดาษ 3.5 / พลาสติก 1.0 / แก้ว 0.3 กก. CO2e + ที่มา (ค่าคงที่ใน component อ้าง `docs/carbon-sources.md` ไม่ใช่อัตราในระบบ) |
| 05 | กิจกรรม | `paper-kraft` (ไล่สี) + ขอบฉีก | ≤3 การ์ดจาก `getOpenActivities()` · ป้ายประเภท `typeLabelTh()` เดิม · ช่วงวันที่ (`formatBangkok` เดิม) · แถบความคืบหน้าตามเวลา + "ผ่านไป N%" "เหลือ N วัน" · "เข้าสู่ระบบเพื่อเข้าร่วม" · ทั้งการ์ดเป็นลิงก์ `/activities/[id]` |
| 06 | ของรางวัล | paper | ≤4 การ์ดจาก `getActiveRewards()` · รูปจริง (`RewardImage` เดิม) หรือพื้นไล่สี · ป้ายราคาเอียง "N แต้ม" · "เหลือ N ชิ้น" · "เข้าสู่ระบบเพื่อแลก" · ลิงก์ `/rewards` |
| 07 | บทความ | `paper-dots` + ขอบฉีก | ≤4 การ์ดจาก `listPublishedArticles()` เดิม (ตัด 4 อันแรก) ปักหมุด เอียงสลับ · ปก หรือ 🌱 · วันที่ · ลิงก์ "ดูบทความทั้งหมด →" ไป `/articles` |
| CTA | ปิดท้าย | ไล่สีเขียว-เหลือง + ใบไม้จาง | h2 · ปุ่ม "สมัครสมาชิก" (หลัก) · "เข้าสู่ระบบ" (รอง) |
| – | SiteFooter | paper | §4 |

### 5.2 ความคืบหน้าตามเวลา

ฟังก์ชันบริสุทธิ์ใหม่ `src/app/_components/home/activity-progress.ts`: `activityProgress(startsAt, endsAt, now)` → `{ percent: 0..100 (ปัดเต็ม), daysLeft: >=0 }` · ยังไม่เริ่ม → percent 0 · เลยวันจบ → 100, daysLeft 0 · daysLeft = จำนวนวันปฏิทิน (เวลากรุงเทพ) จากวันนี้ถึงวันจบ วันสุดท้ายแสดง "เหลือ 0 วัน" (ไม่เพิ่มข้อความใหม่) · คำนวณตอนสร้าง cache (`now` = เวลาตอน render ของ component ภายใน Suspense) · unit test ครอบคลุมยังไม่เริ่ม, ระหว่าง, วันสุดท้าย, เลยแล้ว, ข้ามเที่ยงคืนกรุงเทพ

### 5.3 ข้อความใหม่ (ที่อนุญาตทั้งหมด)

| ที่ | ข้อความ |
|---|---|
| hero h1 | แยกขยะวันนี้ นับเป็นผล ได้จริง ("นับเป็นผล" ไฮไลต์) |
| hero lede | ทุกกิโลกรัมที่นักศึกษาแยกแล้วนำมาชั่ง ถูกบันทึกเป็นแต้ม และคำนวณเป็นก๊าซเรือนกระจกที่ลดได้ ตามค่ามาตรฐานของ อบก. |
| hero ปุ่ม | ดูกิจกรรมที่เปิดรับ → |
| hero | อัปเดตทุก 1 นาที |
| hero รูป | บันทึกที่ 001 · โลกของเรา (คำบรรยายโพลารอยด์, `aria-hidden`) · GREEN ♻ CAMPUS (ตรา, `aria-hidden`) |
| 01 | 01 · ปัญหา · ขยะที่ไม่ได้แยก กลายเป็นก๊าซที่ทำให้โลกร้อน · ขยะที่ปนกันไปฝังกลบ ปล่อยก๊าซเรือนกระจกออกมาเรื่อยๆ ขณะที่ขยะที่แยกแล้วนำไปรีไซเคิล ช่วยทดแทนการผลิตวัตถุดิบใหม่ จึงลดการปล่อยก๊าซได้ การแยกตั้งแต่ต้นทางในวิทยาลัยจึงเป็นจุดเริ่มที่ทุกคนทำได้ · 3.5 กก. CO2e · ลดได้เมื่อรีไซเคิลกระดาษ 1 กก. แทนการผลิตใหม่ · ที่มา: อบก. โครงการ LESS, LESS-WM-01 v06 (ค่า 3.5460) |
| 02 | 02 · ทำอะไร · แยก. ชั่ง. สะสม. แลก. · เข้าร่วมกิจกรรม / เลือกกิจกรรมเก็บขยะที่เปิดอยู่ในวิทยาลัย · นำขยะมาชั่ง / แยกเป็นพลาสติก กระดาษ โลหะ/แก้ว แล้วชั่งที่จุดชั่ง · ได้แต้มและ carbon / เจ้าหน้าที่ตรวจผล ระบบคิดแต้มและ carbon ที่ลดได้ให้ · แลกรางวัล / ใช้แต้มแลกของรางวัล และดูอันดับเพื่อนๆ |
| 03 | 03 · ทำเพื่อใคร · สร้างมาเพื่อนักศึกษา และทุกคนในวิทยาลัย · นักศึกษา: เห็นผลของตัวเองเป็นตัวเลข: แต้ม น้ำหนัก carbon / แลกรางวัลได้จริง และมีอันดับให้แข่งกัน / ส่งผลกิจกรรมจากมือถือได้ในไม่กี่ขั้นตอน · ครูและเจ้าหน้าที่: ตรวจผล ชั่งขยะ จัดกิจกรรม และออกรายงานได้ในที่เดียว · วิทยาลัย: มีข้อมูลขยะและ carbon จริง ใช้วางแผนด้านสิ่งแวดล้อมได้ |
| 04 | 04 · รู้ไว้ · ขยะแต่ละชนิดลดโลกร้อนได้ไม่เท่ากัน · กระดาษ 1 กก. ที่รีไซเคิล · พลาสติก 1 กก. ที่รีไซเคิล · แก้ว 1 กก. ที่รีไซเคิล · ค่าการลดก๊าซเรือนกระจกสุทธิเมื่อรีไซเคิลทดแทนวัตถุดิบใหม่ · อบก. LESS-WM-01 v06 |
| 05 | 05 · กิจกรรม · กิจกรรมที่เปิดรับอยู่ · ผ่านไป · เหลือ · วัน · เข้าสู่ระบบเพื่อเข้าร่วม · ยังไม่มีกิจกรรมที่เปิดรับ · ยังโหลดกิจกรรมไม่ได้ในขณะนี้ |
| 06 | 06 · ของรางวัล · แต้มของคุณ แลกอะไรได้บ้าง · แต้ม · เหลือ · ชิ้น · เข้าสู่ระบบเพื่อแลก |
| 07 | 07 · บทความ · บทความล่าสุด · ดูบทความทั้งหมด → |
| CTA | หน้าแรกในสมุดของคุณ ยังว่างอยู่ |
| footer | เริ่มต้น · อ่าน · ค่า carbon อ้างอิง อบก. LESS-WM-01 v06 |

### 5.4 สถานะว่าง/ผิดพลาด

- กิจกรรม: ว่าง → "ยังไม่มีกิจกรรมที่เปิดรับ" (หัวข้อ 05 ยังแสดง) · โหลดไม่ได้ (`null`) → "ยังโหลดกิจกรรมไม่ได้ในขณะนี้"
- ของรางวัล: ว่างหรือโหลดไม่ได้ → ซ่อนทั้งหัวข้อ 06
- บทความ: ว่างหรือโหลดไม่ได้ → ซ่อนทั้งหัวข้อ 07
- สถิติ: ข้อความเดิม "ยังโหลดสถิติรวมไม่ได้ในขณะนี้"
- แต่ละส่วนข้อมูลอยู่ใน `<Suspense>` ของตัวเอง fallback เป็น skeleton กระดาษขนาดเท่าของจริง (ไม่ให้หน้ากระโดด)
- เลขหัวข้อ (05/06/07) คงที่ แม้บางหัวข้อถูกซ่อน (ยอมรับได้; ไม่คำนวณเลขใหม่)

### 5.5 มือถือ / คอม

- ≥1024px: hero 2 คอลัมน์, การ์ดบทความ/รางวัล 4 คอลัมน์, กิจกรรม 3
- 640–1023px: hero 1 คอลัมน์ (รูปบน), การ์ด 2 คอลัมน์
- <640px: คอลัมน์เดียว, แถวบัญชีตัวเลขเรียงแนวตั้ง (label ซ้าย ตัวเลขขวา), การ์ดบทความ/รางวัล 2 คอลัมน์ที่ ≥400px ไม่งั้น 1
- 360px ไม่มีแถบเลื่อนแนวนอน, ปุ่ม/ลิงก์ทุกตัว ≥44px (WCAG 2.5.8 ขั้นต่ำ 24px สำหรับลิงก์ในประโยค)
- ของตกแต่งทั้งหมด `aria-hidden` และ `pointer-events: none` ไม่บังการกด

---

## 6. หน้าอื่น

- **สาธารณะ/auth** (`/articles`, `/articles/[slug]`, login/register/forgot/reset): SiteHeader + SiteFooter, การ์ดบทความเอียง+หมุด, การ์ดฟอร์ม auth มีเทปด้านบน, หัวข้อหน้ามีไฮไลต์ · `/articles/[slug]` เป็นโหมด Read: ตัวอ่านกว้าง ≤65ch, ไม่มีลูกเล่นในเนื้อหา
- **นักศึกษา**: พื้น grain, ปุ่ม/การ์ดเงาพิมพ์นูน, การ์ดสรุป (dashboard stat) มีเทป, ไม่มีการ์ดเอียงในรายการ/ฟอร์ม, ThemeToggle ไอคอน
- **เจ้าหน้าที่ (รวม weigh-station)**: เหมือนนักศึกษาแต่เบาที่สุด ตาราง/ฟอร์มตรงไม่ตกแต่ง, weigh-station ห้ามมีอะไรขยับนอกจากตัวนับถอยหลังเดิม
- กราฟ `WasteByCategory` ใช้สี chart เดิม

---

## 7. ข้อมูลและฐานข้อมูล (ข้อยกเว้น §1.3)

### 7.1 migration `0026_public_home_feed.sql`

```sql
-- public_open_activities: open activities that have not ended, soonest end first. Safe columns only.
create function public.public_open_activities(p_limit int default 3)
returns table (id uuid, title text, type text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.type, a.starts_at, a.ends_at
  from public.activities a
  where a.status = 'open' and a.ends_at >= now()
  order by a.ends_at asc, a.id
  limit least(greatest(coalesce(p_limit, 3), 1), 12);
$$;

-- public_active_rewards: active rewards in stock, newest first. Safe columns only.
create function public.public_active_rewards(p_limit int default 4)
returns table (id uuid, name text, points_cost int, stock int, image_path text)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.name, r.points_cost, r.stock, r.image_path
  from public.rewards r
  where r.active and r.stock > 0
  order by r.created_at desc, r.id
  limit least(greatest(coalesce(p_limit, 4), 1), 12);
$$;

revoke all on function public.public_open_activities(int) from public;
revoke all on function public.public_active_rewards(int) from public;
grant execute on function public.public_open_activities(int) to anon, authenticated;
grant execute on function public.public_active_rewards(int) to anon, authenticated;
```

(implementer ตรวจรูปแบบให้ตรง `0025_public_stats_students.sql` และรัน `supabase db reset` ผ่าน)

### 7.2 pgTAP `public_home_feed.test.sql`

anon เรียกได้ทั้งสอง · ไม่คืน draft/closed/จบแล้ว · ไม่คืนรางวัล inactive/stock 0 · ลำดับและ limit (รวม p_limit 0, null, 99 ถูก clamp) · คอลัมน์ที่คืนตรงตามที่กำหนด · `prosecdef` = true และ `proconfig` มี `search_path=""`

### 7.3 lib `src/lib/home/public-feed.ts`

- `getOpenActivities(): Promise<PublicActivity[] | null>` และ `getActiveRewards(): Promise<PublicReward[] | null>` (reward มี `imageUrl` จาก `getPublicUrl` ของ bucket `reward-images` แบบเดียวกับ `src/lib/rewards/queries.ts`)
- `'use cache'` + `cacheLife("minutes")` ใช้ `createAnonClient()` เดิม · error → `cacheLife("seconds")` แล้วคืน `null` (แบบเดียวกับ `public-stats.ts`) ห้ามโยน error ใน scope cache
- แปลง snake_case → camelCase; unit test ส่วนแปลงข้อมูล (ฟังก์ชันบริสุทธิ์แยกออกมา)

---

## 8. การทดสอบ

- **gate** HANDOFF §9 ครบก่อนทุก commit + check-scope + ตรวจ build ว่า `/` และ `/articles` ยัง ○
- **vitest**: `activityProgress`, `visibleSocialLinks`, ตรรกะสลับธีม (system→ตรงข้ามของที่แสดง, dark↔light), แปลงข้อมูล public-feed, contrast token ใหม่ทั้งสองธีม (ขยาย `theme-tokens.test.ts`), Card `deco`/`tilt` class
- **pgTAP**: §7.2
- **e2e** (`tests/e2e/home.spec.ts` ใหม่ + ปรับ `theme.spec.ts`):
  - header ยังมองเห็นที่ top 0 หลังเลื่อน 1500px
  - ปุ่มธีม: เริ่ม system (ไม่มี `data-theme`), กด → ตรงข้ามของ `prefers-color-scheme` ที่ emulate, กดอีก → สลับ, reload จำค่า, ไม่กะพริบ (MutationObserver เดิม)
  - anon กด "ดูกิจกรรมที่เปิดรับ" → URL `/login?next=%2Factivities`
  - seed กิจกรรม open 1 อัน + รางวัล 1 ชิ้น → เห็นในหัวข้อ 05/06 · ไม่มีรางวัล → หัวข้อ 06 ไม่มี
  - 360px ไม่มี horizontal scroll ที่ `/`, `/articles`, `/login`, `/dashboard`, `/staff`
  - reduced motion: ใบไม้ร่วงไม่แสดง/ไม่มี animation ที่กำลังเล่น (`getAnimations().length === 0` บนของตกแต่ง)
  - ไม่มี id ซ้ำหลังสลับ `/` ↔ `/articles` ↔ `/login`
- test เดิมทั้งหมดต้องผ่าน; test ที่อิง radiogroup ธีมแบบเดิมเปลี่ยนเป็นปุ่มไอคอน

## 9. ลำดับงาน (รายละเอียดในแผน)

1. Token ใหม่ + พื้นผิวกระดาษ + test contrast
2. ThemeToggle ไอคอน + ผู้เรียกทุกตัว + e2e ธีม
3. Button เงาพิมพ์นูน, Card deco/tilt, SiteHeader, SiteFooter, social-links
4. migration + pgTAP + lib public-feed (ข้อยกเว้น §1.3) + check-scope
5. หน้าแรก
6. สาธารณะ/auth
7. นักศึกษา
8. เจ้าหน้าที่
9. ตรวจ Impeccable (audit/polish) + เก็บงาน + บันทึกผล build ใน §10

## 10. ผลตรวจ build ปิดงาน

(เติมตอนปิดงาน)
