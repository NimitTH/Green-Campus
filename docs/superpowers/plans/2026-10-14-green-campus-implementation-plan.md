# Green Campus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างเว็บแอปกิจกรรมอนุรักษ์สิ่งแวดล้อมที่นักเรียนส่งผลพร้อมหลักฐาน ครู/admin ตรวจ ระบบให้แต้มและ carbon แล้วแลกของรางวัลได้ พร้อมรายงานและข้อมูลสาธิต

**Architecture:** Next.js (App Router, TypeScript) บน Vercel + Supabase Cloud ทุกการเปลี่ยนแปลงแต้ม/สต็อก/รหัส/สถานะ เป็นฟังก์ชัน Postgres `SECURITY DEFINER` ใน transaction เดียว ส่วน CRUD ทั่วไปใช้ Server Actions + RLS ยอดแต้มและ carbon คำนวณจาก `ledger_entries` (เพิ่มรายการอย่างเดียว)

**Tech Stack:** Next.js, TypeScript, Tailwind, Recharts, Supabase (Auth, Postgres, Storage, Realtime, pg_cron), pgTAP, Vitest, Playwright, ไลบรารี PDF ที่เลือกใน Task 14

**Spec:** `docs/superpowers/specs/2026-10-14-waste-management-app-design.md` (ไฟล์ `2026-10-14-waste-management-app-design.md`) ผู้ลงมือต้องอ่านคู่กัน หัวข้อที่อ้างในแผนนี้คือเลขหัวข้อของ spec

## Global Constraints

- น้ำหนักเก็บเป็นกรัมจำนวนเต็ม; 1 ขีด = 100 กรัม; ฟอร์มกรอก kg และขีด (spec §5)
- แต้ม `waste` = ปัดลง(Σ[กรัม × `points_per_kg`] ÷ 1000) ต่อหนึ่งผลที่ส่ง; carbon = Σ[กรัม × `carbon_kg_per_kg` ÷ 1000] ทศนิยม 3 ตำแหน่ง; `trees` = ต้น × `unit_*`; `fixed` = `unit_*` (spec §6.1)
- ค่า carbon ต้องมาจาก อบก. (TGO) พร้อม `source_note` ห้ามเดา; ถ้าไม่มีค่าให้แจ้งเจ้าของโปรเจกต์ (spec §6.2)
- รหัสยืนยัน 6 หลัก ใช้ครั้งเดียว หมดอายุ 30 นาที ผิดครบ 5 ครั้งล็อก สร้างด้วยตัวสุ่มที่ปลอดภัย (spec §6.4)
- ช่วงส่งผล: `starts_at` ถึง 3 วันหลัง `ends_at`; ออเดอร์หมดอายุ 7 วัน (spec §6.3, §6.6)
- ทุกฟังก์ชัน: ตรวจ `auth.uid()` และบทบาทเอง, `SET search_path` ตายตัว, transaction เดียว (spec §7)
- ตาราง participations, weigh_codes, submissions, submission_items, orders, order_items, ledger_entries เขียนตรงจากไคลเอนต์ไม่ได้ (spec §8.1)
- `service_role` key อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามเข้า git หรือเบราว์เซอร์ (spec §8.5)
- ภาษาไทยอย่างเดียว, mobile-first, เวลาแสดงผลและเดือนปฏิทินใช้ Asia/Bangkok (spec §9, §3)
- รูปหลักฐาน: bucket private, jpeg/png/webp, ไม่เกิน 2 MB, ย่อเป้าหมายราว 300 KB (spec §8.4)
- PDF และ CSV: ฝังฟอนต์ไทย / UTF-8 มี BOM; นับเฉพาะผลที่อนุมัติแล้วของกิจกรรมที่จบแล้ว กรองช่วงวันที่ตาม `activities.ends_at` (spec §10)
- ล็อกฟีเจอร์ราว 15 ก.พ. 2027; ฟีเจอร์เสริมทำเมื่อเวลาเหลือเท่านั้น (spec §12)

## Review Focus

1. **กดส่งผลซ้ำสองครั้งติดกันบนมือถือ (double-tap/สัญญาณช้า) ด้วยรหัสเดียว:** ต้องสำเร็จครั้งเดียว ครั้งที่สองได้ข้อความไทยที่เข้าใจได้ ไม่ได้ผลซ้ำสองรายการ (Task 8)
2. **รูปจากกล้องมือถือ (HEIC จาก iPhone, ไฟล์ใหญ่ >2 MB, ไม่ใช่รูป):** ต้องถูกแปลงเป็น JPEG ย่อขนาดก่อนอัปโหลด หรือปฏิเสธพร้อมข้อความ ไม่ปล่อยให้ค้างที่หน้าโหลด (Task 8)
3. **ชื่อนักเรียนใน CSV ที่ขึ้นต้นด้วย `=`, `+`, `-`, `@` หรือมีจุลภาค/ขึ้นบรรทัดใหม่:** ต้อง escape ไม่ให้ Excel รันสูตรหรือคอลัมน์เลื่อน (Task 16)
4. **รายงานช่วงวันที่ที่ไม่มีกิจกรรมเลย:** CSV ต้องมีแถวหัวคอลัมน์ PDF ต้องออกเป็นหน้าสรุปศูนย์พร้อมกราฟว่าง ไม่ error (Task 16, 17)
5. **ขอบเดือนเขตเวลาไทย (เช่น อนุมัติ 31 ต.ค. เวลา 23:30 ไทย = 16:30 UTC):** ต้องนับอยู่ในอันดับเดือน ต.ค. ไม่ใช่ พ.ย. (Task 15)

---

## File Structure

```
supabase/
  migrations/NNNN_*.sql          # schema ทั้งหมด (สร้างซ้ำได้ทุกสภาพแวดล้อม)
  tests/*.test.sql               # pgTAP
  seed/                          # สคริปต์ seed + รีเซ็ต (Task 20)
src/
  app/(public)/ (auth)/ (student)/ staff/   # เส้นทางตาม spec §9
  app/api/ receipts/[orderId]/ reports/ cron/  # Route Handlers
  lib/supabase/{browser,server,admin}.ts
  lib/{units,csv,image,errors}.ts
  lib/pdf/{fonts,receipt,summary}.ts(x)
  components/ ...
tests/e2e/                       # Playwright
docs/superpowers/{specs,plans}/
```

หนึ่งไฟล์ต่อหนึ่งหน้าที่ ฟังก์ชัน SQL แยกไฟล์ migration ตามโมดูล (spec §4.2)

---

# เฟส 0 (ปลาย ต.ค.): โครงกระดูก

### Task 1: Scaffold, Supabase local/test, deploy

**Files:** Create `package.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/supabase/{browser,server,admin}.ts`, `.env.example`, `vitest.config.ts`, `README.md`; Test `src/lib/supabase/server.test.ts`

**Interfaces:**
- Produces: `createBrowserClient(): SupabaseClient` (anon), `createServerClient(): Promise<SupabaseClient>` (cookie session), `createAdminClient(): SupabaseClient` (service_role, ไฟล์เริ่มด้วย `import "server-only"`)

- [ ] **Step 1:** สร้างโปรเจกต์ Next.js (TypeScript, Tailwind, App Router) ฟอนต์ Sarabun ผ่าน `next/font`; `supabase init`; รัน `supabase start` ถ้า Docker ได้ ไม่ได้ให้สร้างโปรเจกต์ Supabase ฟรีตัวที่ 2 เป็นโปรเจกต์ทดสอบ (spec §4.4) และจดวิธีไว้ใน README
- [ ] **Step 2:** เขียนเทสต์ `admin client is not importable from client bundle`: ตรวจว่า `admin.ts` มี `import "server-only"` และ `.env.example` ไม่มีค่าจริงของ `SUPABASE_SERVICE_ROLE_KEY`
- [ ] **Step 3:** รัน `npx vitest run` ต้องล้มก่อน แล้วเขียนไคลเอนต์ทั้งสามตัวตาม Interfaces ให้ผ่าน
- [ ] **Step 4:** ผูก Vercel กับ repo, ใส่ env บน Vercel, deploy หน้าแรกเปล่า; รัน `curl -I <url>` ต้องได้ 200
- [ ] **Step 5:** commit `chore: scaffold next.js + supabase + vitest`

### Task 2: Schema migration

**Files:** Create `supabase/migrations/0001_schema.sql`; Test `supabase/tests/schema.test.sql`

**Interfaces:**
- Produces: ตารางและคอลัมน์ทั้งหมดตาม spec §5 (ชื่อและชนิดตามตารางใน spec), enum/check สำหรับ role, activity type/status, ledger kind, submission/order status; ดัชนี: unique `(activity_id, student_id)` ใน participations, unique `(student_id, reward_id)` ใน cart_items, **partial unique** บน weigh_codes `(activity_id, student_id) WHERE used_at IS NULL AND revoked_at IS NULL`

- [ ] **Step 1:** เขียน pgTAP `schema.test.sql` ด้วยการยืนยัน: (ก) แทรก weigh_codes ที่ยังใช้ได้ซ้ำคู่เดิมต้อง `throws_ok` 23505, (ข) `submission_items` ของ activity `waste` ที่ไม่มี `waste_category_id` ต้องถูกปฏิเสธ (ค) quantity ≤ 0 ถูกปฏิเสธ (ง) `ledger_entries.kind` นอก 4 ค่าถูกปฏิเสธ
- [ ] **Step 2:** `supabase test db` ต้องล้ม (ยังไม่มีตาราง)
- [ ] **Step 3:** เขียน migration ตาม spec §5 และ §5.1 รวม `created_at`/`updated_at` (trigger อัปเดต) และข้อจำกัดข้างต้น ข้อ (ข) ใช้ trigger ตรวจกับ `activities.type`
- [ ] **Step 4:** `supabase db reset && supabase test db` ต้องผ่านทั้งหมด
- [ ] **Step 5:** commit `feat(db): core schema and constraints`

### Task 3: Auth, roles, RLS

**Files:** Create `supabase/migrations/0002_auth_rls.sql`, `src/app/(auth)/{login,register,forgot-password,reset-password}/page.tsx`, `src/middleware.ts`; Test `supabase/tests/rls.test.sql`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: ตารางจาก Task 2
- Produces: `is_staff() returns boolean`, `is_admin() returns boolean` (`SECURITY DEFINER`, stable); trigger `handle_new_user` (สร้าง `profiles` role=`student`, `display_name = full_name`); trigger `protect_profile_columns` (ปฏิเสธเปลี่ยน `role`/`is_demo` นอกฟังก์ชัน admin); นโยบาย RLS ตามตารางสิทธิ์ spec §8.1; middleware กันเส้นทาง `/staff/**` สำหรับ role ที่ไม่ใช่ staff และ `/staff/users`, `/staff/rates` สำหรับ non-admin

- [ ] **Step 1:** เขียน pgTAP `rls.test.sql` (ล็อกอินจำลองด้วย `set_config('request.jwt.claims', …)`): นักเรียน `UPDATE profiles SET role='admin'` ต้องล้ม; `INSERT INTO ledger_entries` ตรงต้องล้ม; อ่าน `submissions` ของนักเรียนอีกคนได้ 0 แถว; ครูอ่านทุกแถวได้; ผู้ใช้ใหม่ที่ถูกสร้างได้ role=`student` และ `display_name` = ชื่อจริง
- [ ] **Step 2:** รัน ต้องล้ม
- [ ] **Step 3:** เขียน migration และหน้า auth (ฟอร์มภาษาไทย, ข้อความผิดพลาดบอกว่าต้องทำอะไรต่อ) ลืมรหัสผ่านใช้ `resetPasswordForEmail`
- [ ] **Step 4:** ตั้ง **custom SMTP** ใน Supabase Cloud (เลือกผู้ให้บริการตามเงื่อนไขล่าสุด spec §8.6, §14) และปรับขีดจำกัดอีเมลต่อชั่วโมง; จดค่าที่ตั้งไว้ใน README; เทสต์ด้วยอีเมลภายนอก 2 บัญชี (สมัคร + ลืมรหัส) ต้องได้อีเมลจริง
- [ ] **Step 5:** Playwright `auth.spec.ts`: สมัคร → ล็อกอิน → เข้า `/dashboard` ได้ และเข้า `/staff` แล้วถูกส่งกลับ
- [ ] **Step 6:** รัน pgTAP + Playwright ต้องผ่าน แล้ว commit `feat: auth, roles and RLS`

**เกณฑ์จบเฟส 0:** deploy ออนไลน์ได้ สมัครแล้วได้อีเมลจริง (spec §12)

---

# เฟส 1 (พ.ย.): แกนหลัก

### Task 4: ฟังก์ชันคำนวณฝั่งแอป

**Files:** Create `src/lib/units.ts`; Test `src/lib/units.test.ts`

**Interfaces:**
- Produces: `toGrams(kg: number, khit: number): number`; `type Rates = { pointsPerKg: number; carbonKgPerKg: number }`; `estimateWaste(items: {grams:number; rates:Rates}[]): {points:number; carbonKg:number}` (สูตรเดียวกับ SQL spec §6.1 ใช้เพื่อกล่อง "ประมาณการ" เท่านั้น)

- [ ] **Step 1:** เทสต์ `toGrams(1,5)===1500`, `toGrams(0,1)===100`, `toGrams(0.5,0)===500`, `toGrams(0.0004,0)===0` (kg ทศนิยมปัดเป็นกรัมใกล้สุด), ค่าลบ/NaN/Infinity throw, ขีดที่ไม่ใช่จำนวนเต็มไม่รับ; `estimateWaste` ของ 1500 g × 10 แต้ม/kg = 15 แต้ม, 999 g × 1 = 0 แต้ม (ปัดลง), carbon ปัด 3 ตำแหน่ง
- [ ] **Step 2:** `npx vitest run src/lib/units.test.ts` ต้องล้ม
- [ ] **Step 3:** implement ตาม Interfaces ด้วยเลขจำนวนเต็มกรัมตลอด ไม่คูณทศนิยมสะสม
- [ ] **Step 4:** รันต้องผ่าน; commit `feat: unit conversion and point estimate`

### Task 5: อัตรา carbon จาก อบก. + ค่าเริ่มต้น waste_categories

**Files:** Create `docs/carbon-sources.md`, `supabase/migrations/0003_waste_categories.sql`; Test `supabase/tests/rates.test.sql`

**Interfaces:**
- Produces: แถวใน `waste_categories` 4 กลุ่ม (พลาสติก, กระดาษ, โลหะ/แก้ว, ขยะทั่วไป/อื่นๆ) พร้อม `points_per_kg`, `carbon_kg_per_kg`, `source_note`

- [ ] **Step 1:** ค้นค่าจาก อบก. (WebSearch/WebFetch เว็บ tgo.or.th) ทีละกลุ่ม บันทึกค่า ชื่อเอกสาร ปี และ URL ใน `docs/carbon-sources.md`
- [ ] **Step 2:** **หยุดและแจ้งผู้ใช้** ถ้ากลุ่มใดไม่มีค่าที่ตรงใน อบก. (spec §6.2) ห้ามเติมตัวเลขเอง ถามว่าจะใช้ค่าประมาณที่ระบุชัดเจนหรือแหล่งอื่น; `points_per_kg` เป็นการตัดสินใจของผู้ใช้ ถามค่าที่ต้องการ
- [ ] **Step 3:** เทสต์ `rates.test.sql`: ทุกแถวมี `source_note` ไม่ว่าง, ค่า ≥ 0
- [ ] **Step 4:** เขียน migration จากค่าที่ยืนยัน รัน pgTAP ผ่าน; commit `feat: carbon rates from TGO`

### Task 6: กิจกรรมและการเข้าร่วม

**Files:** Create `supabase/migrations/0004_activities.sql`, `src/app/staff/activities/{page,new/page,[id]/edit/page}.tsx`, `src/app/(student)/activities/{page,[id]/page}.tsx`, `src/app/actions/activities.ts`; Test `supabase/tests/join_activity.test.sql`, `tests/e2e/activities.spec.ts`

**Interfaces:**
- Produces: `join_activity(p_activity_id uuid) returns void` (ข้อผิดพลาดด้วย `RAISE EXCEPTION` ข้อความรหัส `activity_not_open | activity_ended | already_joined`); Server Actions `saveActivity(input: ActivityInput): Promise<{id:string}>` โดย `requires_code` ตั้งค่าเริ่มต้นตาม type (waste=true, อื่น=false, ครูเปลี่ยนได้); นักเรียนเห็นเฉพาะกิจกรรม `open` และที่ตนเคยเข้าร่วม (RLS)

- [ ] **Step 1:** เทสต์ pgTAP: `join_activity` กับ `draft`/`closed`/เลย `ends_at` ต้อง throw ตามรหัส; เรียกซ้ำ throw `already_joined`; ผู้ใช้ไม่ล็อกอินล้ม; ลบกิจกรรมที่มีผลแล้วต้องล้ม (spec §8.1)
- [ ] **Step 2:** รันต้องล้ม
- [ ] **Step 3:** implement ฟังก์ชันและนโยบาย; ฟอร์มสร้าง/แก้กิจกรรม (หน่วยวัด 3 ชนิด, `requires_code`, `is_offsite`, วันเวลา) และหน้ารายการ/รายละเอียดฝั่งนักเรียนพร้อมสถานะโหลด/ว่าง
- [ ] **Step 4:** Playwright: ครูสร้างกิจกรรม `open` → นักเรียนเห็นและกดเข้าร่วม ปุ่มกลายเป็น "เข้าร่วมแล้ว"
- [ ] **Step 5:** รันทั้งหมดผ่าน; commit `feat: activities and join`

### Task 7: รหัสจุดชั่ง

**Files:** Create `supabase/migrations/0005_weigh_codes.sql`, `src/app/staff/weigh-station/page.tsx`; Test `supabase/tests/weigh_codes.test.sql`

**Interfaces:**
- Produces: `issue_weigh_code(p_activity_id uuid, p_student_id uuid) returns table(code text, expires_at timestamptz)` เฉพาะ staff, กิจกรรม `requires_code`, นักเรียนเป็นผู้เข้าร่วม, อยู่ในช่วงส่งผล; revoke รหัสเก่าที่ยังไม่ใช้; สุ่มด้วย `gen_random_bytes` (pgcrypto)

- [ ] **Step 1:** เทสต์: นักเรียนเรียกแล้วล้ม; ไม่ใช่ผู้เข้าร่วมล้ม; กิจกรรมไม่บังคับรหัสล้ม; ออกซ้ำ → รหัสเก่ามี `revoked_at`; `expires_at - now()` อยู่ 30 นาที ±5 วินาที; รหัสมี 6 หลักตัวเลขเสมอ (รวมที่ขึ้นต้นด้วย 0)
- [ ] **Step 2:** รันต้องล้ม
- [ ] **Step 3:** implement ฟังก์ชัน; หน้าจุดชั่ง: เลือกกิจกรรม ค้นหานักเรียน กดออกรหัส แสดงรหัสตัวใหญ่ + นับถอยหลัง 30 นาที ปุ่มใหญ่ ใช้ได้บนมือถือ/แท็บเล็ต (spec §9.3)
- [ ] **Step 4:** รันผ่าน; commit `feat: weigh station codes`

### Task 8: ส่งผล (submit_result) + อัปโหลดรูป

**Files:** Create `supabase/migrations/0006_submit_result.sql`, `src/lib/image.ts`, `src/lib/errors.ts`, `src/app/(student)/activities/[id]/submit/page.tsx`, storage policies ใน `0006`; Test `supabase/tests/submit_result.test.sql`, `src/lib/image.test.ts`, `tests/e2e/submit.spec.ts`

**Interfaces:**
- Consumes: `toGrams`, `estimateWaste` (Task 4), `join_activity`, `issue_weigh_code`
- Produces: `submit_result(p_activity_id uuid, p_code text, p_items jsonb, p_evidence_path text) returns jsonb` รูปแบบ `{ok: boolean, error_code: text|null, submission_id: uuid|null}` โดย `error_code ∈ code_required | code_invalid | code_expired | code_locked | not_participant | out_of_window | over_limit | invalid_items | bad_evidence_path`; `p_items` = `[{waste_category_id?: uuid, quantity: int}]`; `resizeToJpeg(file: File, maxEdge?: number, quality?: number): Promise<Blob>`; `errorMessageTh(code: string): string`

- [ ] **Step 1:** เขียน pgTAP: (ก) รหัสผิด → คืน `code_invalid` และ `attempts` เพิ่มจริงหลังจบ (ไม่ถูก rollback) (ข) ผิดครบ 5 ครั้ง → `code_locked` แม้ครั้งที่ 6 ใส่รหัสถูก (ค) รหัสถูกครั้งแรกสำเร็จ ครั้งที่สองด้วยรหัสเดิมได้ `code_invalid` (ง) หมดอายุ → `code_expired` (จ) quantity 0/ลบ → `invalid_items` (ฉ) เกิน `max_per_submission` → `over_limit` (ช) `p_evidence_path` ไม่ขึ้นต้นด้วย `auth.uid()/` → `bad_evidence_path` (ซ) กิจกรรมไม่บังคับรหัสส่งได้โดยไม่มีรหัส (ฌ) **Review Focus 1:** เรียก `submit_result` สองครั้งซ้อนกันด้วยรหัสเดียว (สองการเชื่อมต่อ ใช้ `dblink`/สองเซสชันใน script) ต้องได้ submission เดียว
- [ ] **Step 2:** รันต้องล้ม
- [ ] **Step 3:** implement ฟังก์ชัน: ล็อกแถวรหัสด้วย `FOR UPDATE` ก่อนตรวจ; กรณีรหัสผิด/หมดอายุ/ล็อกคืนผลลัพธ์ ไม่ `RAISE` (spec §7.1 ข้อ 4); สำเร็จแล้วตั้ง `used_at`, สร้าง submission `pending` + items, แจ้งเตือนครู/admin (เรียกตารางแจ้งเตือนจาก Task 2)
- [ ] **Step 4:** Vitest `image.test.ts` (**Review Focus 2**): ไฟล์ HEIC/เกิน 2 MB ถูกแปลงเป็น `image/jpeg` ขนาด ≤ 2 MB; ไฟล์ที่ไม่ใช่รูปคืน error ที่ `errorMessageTh('not_image')` ไม่ throw ค้าง
- [ ] **Step 5:** ฟอร์มส่งผล (spec §9.4): ช่อง kg/ขีดแยกกลุ่ม, ปุ่มถ่ายรูป `capture`, ช่องรหัส (เมื่อบังคับ), กล่องประมาณการ; ลำดับ: ย่อรูป → อัปโหลด → เรียกฟังก์ชัน; ปุ่มส่งปิดทันทีหลังกด (กันกดซ้ำ) และแสดงข้อความไทยตาม `error_code`
- [ ] **Step 6:** Playwright: ครูออกรหัส → นักเรียนกรอกรหัสผิดแล้วถูก → ส่งสำเร็จ → `/my-submissions` เห็น `pending`
- [ ] **Step 7:** รันทั้งหมดผ่าน; commit `feat: submit result with evidence`

### Task 9: ตรวจผล + ledger

**Files:** Create `supabase/migrations/0007_review.sql`, `src/app/staff/reviews/{page,[id]/page}.tsx`; Test `supabase/tests/review.test.sql`

**Interfaces:**
- Consumes: `submit_result`
- Produces: `approve_submission(p_submission_id uuid) returns void`; `reject_submission(p_submission_id uuid, p_reason text) returns void`; view `student_balance(student_id uuid, points bigint, carbon_kg numeric)` (แต้ม = Σ points ทุก kind; carbon = Σ carbon_kg ของ `earn` และ `adjust` ตาม spec §5.1); ผู้ตรวจต้องเป็น staff ที่ไม่ใช่เจ้าของผล

- [ ] **Step 1:** เทสต์: อนุมัติ waste 1500 g @ อัตราที่ตั้ง → ledger `earn` ตรงตามสูตร §6.1 (ใช้อัตรา ณ ขณะนั้น: เปลี่ยนอัตราหลังอนุมัติแล้วยอดเก่าไม่เปลี่ยน); อนุมัติซ้ำ throw และ ledger ไม่เพิ่ม; trees/fixed ตามสูตร; `unit_carbon_kg` ว่าง → carbon 0; ผู้ตรวจเป็นเจ้าของผลล้ม; ปฏิเสธไม่มีเหตุผลล้ม; สถานะไม่ใช่ pending ล้ม; แจ้งเตือนถึงนักเรียนถูกสร้าง
- [ ] **Step 2:** รันต้องล้ม
- [ ] **Step 3:** implement; หน้าตรวจ: รูป (signed URL สั้น) ข้างตัวเลข, ธงน้ำหนักผิดปกติ (> ค่าเฉลี่ยของกิจกรรม ×3), ปุ่มอนุมัติ/ปฏิเสธ
- [ ] **Step 4:** รันผ่าน; commit `feat: review and ledger`

### Task 10: แจ้งเตือน (กระดิ่ง + Realtime)

**Files:** Create `src/components/NotificationBell.tsx`, `src/app/(student)/notifications/page.tsx`, migration เปิด Realtime บน `notifications`; Test `tests/e2e/notifications.spec.ts`

**Interfaces:**
- Consumes: แถว `notifications` จาก Task 8-9, 13
- Produces: `NotificationBell` ติดตั้งใน layout ทั้งฝั่งนักเรียนและ staff; ฟังก์ชัน SQL `notify(p_user uuid, p_type text, p_title text, p_body text, p_link text) returns void` (ใช้ภายในฟังก์ชันอื่น); `mark_read(p_id uuid)` ผ่าน RLS update `read_at`

- [ ] **Step 1:** Playwright สองบริบท: นักเรียนเปิดหน้า, ครูอนุมัติผล → ตัวเลขบนกระดิ่งของนักเรียนเพิ่มภายใน 3 วินาทีโดยไม่รีเฟรช; กดอ่านแล้วตัวเลขลด; หน้าประวัติแสดงรายการ
- [ ] **Step 2:** รันต้องล้ม
- [ ] **Step 3:** implement (Realtime ตามสิทธิ์ RLS ของผู้ใช้เอง, ไม่รับแจ้งเตือนของคนอื่น)
- [ ] **Step 4:** รันผ่าน; commit `feat: realtime notifications`

### Task 11: Dashboard นักเรียน + ประวัติ

**Files:** Create `src/app/(student)/{dashboard,my-submissions}/page.tsx`, `src/components/charts/WasteByCategory.tsx`; Test `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: view `student_balance` (Task 9)
- Produces: `/dashboard` แสดงแต้ม carbon กราฟน้ำหนักแยก 4 กลุ่มจากผลที่อนุมัติ ประวัติล่าสุด

- [ ] **Step 1:** Playwright: นักเรียนที่ได้อนุมัติ 1 ผล เห็นแต้มและ carbon ตรงกับค่าที่คำนวณ; ไม่มีผลเลย เห็นสถานะว่าง "ยังไม่มีผลกิจกรรม" ไม่ใช่กราฟพัง
- [ ] **Step 2:** implement ด้วย Recharts; รันผ่าน; commit `feat: student dashboard`

**เกณฑ์จบเฟส 1:** flow สร้างกิจกรรม → แต้มเข้าบัญชีครบ (spec §12)

---

# เฟส 2 (ธ.ค.): รางวัล

### Task 12: ของรางวัลและ cart

**Files:** Create `supabase/migrations/0008_rewards_cart.sql`, `src/app/staff/rewards/*`, `src/app/(student)/{rewards,cart}/page.tsx`; Test `tests/e2e/cart.spec.ts`

**Interfaces:**
- Produces: CRUD ของรางวัลโดย staff (รูปใน bucket `reward-images` public-read) ; Server Actions `addToCart(rewardId: string, qty: number)`, `setCartQty(rewardId: string, qty: number)`, `removeFromCart(rewardId: string)`; cart ไม่กันสต็อก

- [ ] **Step 1:** Playwright: เพิ่มของ 2 ชิ้นลง cart → ยอดรวมแต้มถูก; ของ `active=false` เพิ่มไม่ได้; qty ≤ 0 ลบรายการ
- [ ] **Step 2:** implement; รันผ่าน; commit `feat: rewards and cart`

### Task 13: checkout, ออเดอร์, หมดอายุ

**Files:** Create `supabase/migrations/0009_orders.sql`, `src/app/(student)/orders/{page,[id]/page}.tsx`, `src/app/staff/orders/page.tsx`, `src/app/actions/orders.ts`; Test `supabase/tests/orders.test.sql`, `tests/e2e/checkout.spec.ts`

**Interfaces:**
- Consumes: `student_balance`, `notify`
- Produces: `checkout() returns jsonb` `{ok:boolean, order_id:uuid|null, blocked:[{reward_id, reason:'stock'|'points'}]}`; `complete_order(p_order_id uuid) returns void`; `cancel_order(p_order_id uuid) returns void`; `expire_orders() returns integer` (จำนวนที่หมดอายุ); งาน pg_cron เรียก `expire_orders()` ทุกชั่วโมง; ปุ่ม admin "ยกเลิกออเดอร์ที่หมดอายุ" เรียกฟังก์ชันเดียวกัน

- [ ] **Step 1:** เขียน pgTAP: (ก) แต้มไม่พอ → `ok=false` ไม่มีอะไรเปลี่ยน ระบุชิ้นที่ติด (ข) สต็อกไม่พอ → ล้มทั้งออเดอร์ (ค) สำเร็จ: สต็อกลด, `redeem` ติดลบ, `unit_cost` ตรงราคาตอนสั่ง, cart ว่าง, `expires_at` = +7 วัน (ง) **กดพร้อมกันสองเซสชัน** ด้วยแต้มพอสำหรับครั้งเดียว → สำเร็จ 1 ล้ม 1 และยอดไม่ติดลบ (จ) ของเหลือ 1 ชิ้น สองคนแลกพร้อมกัน → ได้คนเดียว (ฉ) `cancel_order` และ `expire_orders` คืนสต็อก + `refund` ครบ และเรียกซ้ำไม่คืนซ้ำ (ช) `complete_order` กับสถานะอื่นล้ม
- [ ] **Step 2:** รันต้องล้ม
- [ ] **Step 3:** implement: ล็อกแถว `profiles` ของนักเรียนก่อนคำนวณยอด แล้วล็อกแถว `rewards` เรียงตาม id (กัน deadlock); ตั้ง `cron.schedule('expire-orders','0 * * * *', 'select expire_orders()')`
- [ ] **Step 4:** หน้าออเดอร์/staff/orders (ยืนยันรับแล้ว/ยกเลิก); Playwright เส้นทาง: ได้แต้ม → ใส่ cart → แลก → ครูยืนยันรับ → สถานะ `completed`
- [ ] **Step 5:** รันผ่าน; commit `feat: checkout, orders and expiry`

### Task 14: PDF — spike ฟอนต์ไทย + ใบเสร็จ

**Files:** Create `src/lib/pdf/fonts.ts`, `src/lib/pdf/receipt.tsx`, `public/fonts/Sarabun-*.ttf`, `src/app/api/receipts/[orderId]/route.ts`, `docs/pdf-library-decision.md`; Test `src/lib/pdf/receipt.test.ts`

**Interfaces:**
- Produces: `renderReceipt(order: ReceiptData): Promise<Uint8Array>`; `ReceiptData = {orderNo:string; createdAt:Date; studentName:string; status:string; expiresAt:Date; items:{name:string; qty:number; unitCost:number}[]; totalPoints:number}`; route `GET /api/receipts/[orderId]` ตรวจว่าผู้ขอเป็นเจ้าของออเดอร์หรือ staff (spec §8.5)

- [ ] **Step 1 (spike):** ทดลอง `@react-pdf/renderer` กับ `pdfmake` (หรืออื่น) เรนเดอร์ข้อความทดสอบที่มีสระ/วรรณยุกต์ซ้อน เช่น "ที่ น้ำ ผู้ ก็ เก็บขยะ ปลูกต้นไม้" แปลงหน้าเป็นภาพ (`pdftoppm`) และตรวจด้วยตา; บันทึกผลและเหตุผลเลือกใน `docs/pdf-library-decision.md`; เกณฑ์ผ่านคือไม่มีกล่องสี่เหลี่ยมและวรรณยุกต์ไม่ลอยผิดตำแหน่ง; ใช้ไลบรารีที่ผ่านกับทั้งใบเสร็จและรายงาน (Task 17)
- [ ] **Step 2:** เทสต์ `renderReceipt`: คืน bytes ขึ้นต้นด้วย `%PDF`; `pdffonts` ของไฟล์มีฟอนต์ Sarabun ฝังอยู่; ข้อความที่แยกด้วย `pdftotext` มีเลขออเดอร์และชื่อรายการภาษาไทยครบ
- [ ] **Step 3:** รันต้องล้ม แล้ว implement ตาม Interfaces; ใส่ route ตรวจสิทธิ์; เทสต์ว่านักเรียนคนอื่นขอใบเสร็จได้ 403
- [ ] **Step 4:** ปุ่มดาวน์โหลดในหน้า `/orders/[id]` (ทั้งสถานะรอรับและรับแล้ว); รันผ่าน; commit `feat: receipt pdf with thai font`

**เกณฑ์จบเฟส 2:** แลกของถูกต้องแม้กดพร้อมกัน ใบเสร็จไทยครบ (spec §12)

---

# เฟส 3 (ม.ค.): ส่วนเสริม

### Task 15: อันดับ, public_stats, หน้าแรก

**Files:** Create `supabase/migrations/0010_reporting.sql`, `src/app/(student)/leaderboard/page.tsx`, ปรับ `src/app/page.tsx`; Test `supabase/tests/leaderboard.test.sql`

**Interfaces:**
- Produces: `leaderboard(p_period text) returns table(rank int, display_name text, carbon_kg numeric, is_me boolean)` โดย `p_period ∈ 'month' | 'all'`, เดือนปฏิทินตาม `Asia/Bangkok`, นับ ledger `earn`+`adjust`, คืน 10 อันดับแรก **และแถวของผู้เรียกเองเสมอ**; `public_stats() returns jsonb` `{carbon_kg, waste_grams, trees}` (เรียกได้จาก anon, ไม่มีข้อมูลรายบุคคล)

- [ ] **Step 1:** เทสต์: (**Review Focus 5**) รายการ `earn` ที่ `created_at` = `2026-10-31 16:30+00` ต้องนับในเดือน ต.ค. และ `2026-10-31 17:30+00` นับเดือน พ.ย. (ตั้งเวลาปัจจุบันจำลองด้วยพารามิเตอร์ `p_now timestamptz default now()` ที่เทสต์ส่งเข้าไป); `redeem`/`refund` ไม่กระทบอันดับ; `adjust` ติดลบลดอันดับ; ผู้เรียกที่อยู่นอก 10 อันดับยังเห็นแถวตนเอง; `display_name` ว่างแสดงเป็น "ไม่ระบุชื่อ"; anon เรียก `leaderboard` ไม่ได้ แต่เรียก `public_stats` ได้และผลไม่มี id/ชื่อ
- [ ] **Step 2:** รันต้องล้ม; implement; หน้าอันดับแบบสลับแท็บ และหน้าแรกแสดง `public_stats`
- [ ] **Step 3:** รันผ่าน; commit `feat: leaderboard and public stats`

### Task 16: รายงาน (ข้อมูล + CSV)

**Files:** Create `src/lib/csv.ts`, `supabase/migrations/0011_reports.sql`, `src/app/staff/reports/page.tsx`, `src/app/api/reports/csv/route.ts`; Test `src/lib/csv.test.ts`, `supabase/tests/reports.test.sql`

**Interfaces:**
- Produces: `toCsv(rows: (string|number|null)[][]): string` (ขึ้นต้นด้วย `﻿`, บรรทัดสิ้นสุด `\r\n`); `report_activities(p_from date, p_to date) returns table(title text, ends_on date, participants int, approved_submissions int, grams_plastic int, grams_paper int, grams_metal_glass int, grams_other int, trees int, points int, carbon_kg numeric)`; `report_students(p_from date, p_to date) returns table(full_name text, points int, carbon_kg numeric, grams_total int, trees int)` กรองตาม `activities.ends_at` ในเขตเวลา Asia/Bangkok และนับเฉพาะผลที่อนุมัติของกิจกรรมที่จบแล้ว; route รับ `kind=activities|students&from&to` เฉพาะ staff

- [ ] **Step 1:** เทสต์ Vitest (**Review Focus 3**): `toCsv([["=1+1","a,b","x\ny"]])` → เซลล์แรกขึ้นต้น `'` (กันสูตร), เซลล์สองและสามอยู่ในเครื่องหมายคำพูดตาม RFC 4180; ขึ้นต้นด้วย BOM; ภาษาไทยไม่ถูกแปลง
- [ ] **Step 2:** เทสต์ pgTAP: ผลที่ pending/rejected ไม่นับ; กิจกรรมที่ยังไม่จบไม่นับ; ผลอนุมัติหลังกิจกรรมจบนับตามวัน `ends_at`; (**Review Focus 4**) ช่วงที่ไม่มีกิจกรรมคืน 0 แถว
- [ ] **Step 3:** รันต้องล้ม; implement; route CSV ต้องส่งหัวคอลัมน์ภาษาไทยแม้ไม่มีข้อมูล และหัว `Content-Type: text/csv; charset=utf-8`; หน้ารายงานมีหมายเหตุเกณฑ์นับ (spec §10)
- [ ] **Step 4:** รันผ่าน; commit `feat: reports data and csv`

### Task 17: รายงาน PDF พร้อมกราฟ

**Files:** Create `src/lib/pdf/summary.tsx`, `src/app/api/reports/pdf/route.ts`; Test `src/lib/pdf/summary.test.ts`

**Interfaces:**
- Consumes: `report_activities` (Task 16), ไลบรารี/ฟอนต์จาก Task 14
- Produces: `renderSummary(data: {from:Date; to:Date; totals:{carbonKg:number; wasteGrams:number; trees:number}; byActivity:{title:string; carbonKg:number; wasteGrams:number; trees:number}[]; byCategory:{name:string; grams:number}[]}): Promise<Uint8Array>` กราฟ 3 ตัว (carbon, น้ำหนักแยก 4 กลุ่ม, ต้นไม้) วาดเป็นเวกเตอร์ในไลบรารี PDF ไม่ใช้เบราว์เซอร์เสมือน

- [ ] **Step 1:** เทสต์: ข้อมูลปกติ → `pdftotext` มีชื่อกิจกรรมไทยและยอดรวม, `pdffonts` มีฟอนต์ฝัง; ข้อมูลว่างทั้งหมด (**Review Focus 4**) → ยังได้ PDF 1 หน้าที่มีข้อความ "ไม่มีข้อมูลในช่วงที่เลือก" และกราฟศูนย์ ไม่ throw
- [ ] **Step 2:** รันต้องล้ม; implement; ตรวจด้วยตาจากภาพ `pdftoppm` ว่ากราฟและภาษาไทยอ่านได้
- [ ] **Step 3:** รันผ่าน; commit `feat: summary pdf with charts`

### Task 18: Dashboard เว็บรวม/staff, profile, บทความ, จัดการผู้ใช้และอัตรา

**Files:** Create `supabase/migrations/0012_admin.sql`, `src/app/staff/{page,users/page,rates/page,articles/*}.tsx`, `src/app/(public)/articles/*`, `src/app/(student)/profile/page.tsx`; Test `supabase/tests/admin.test.sql`

**Interfaces:**
- Produces: `set_user_role(p_user uuid, p_role text) returns void` (admin เท่านั้น; ห้ามลดระดับ admin คนสุดท้าย; บัญชี `is_demo` เปลี่ยนบทบาท/ลดระดับ admin จริงไม่ได้ spec §8.3); `adjust_ledger(p_student uuid, p_points int, p_carbon_kg numeric, p_note text) returns void` (note ห้ามว่าง); admin แก้ `waste_categories` ได้ ครูแก้ไม่ได้; นักเรียนแก้ `display_name`/`full_name` ได้เท่านั้น

- [ ] **Step 1:** เทสต์ pgTAP: ลดระดับ admin คนสุดท้ายล้ม; บัญชีสาธิตเปลี่ยน role ของ admin จริงล้ม; ครูเรียก `set_user_role` ล้ม; `adjust_ledger` ไม่มี note ล้ม; ครู `UPDATE waste_categories` ล้ม
- [ ] **Step 2:** รันต้องล้ม; implement พร้อมหน้าจอ; dashboard staff แสดงงานรอตรวจ ออเดอร์รอรับ ยอดสะสม
- [ ] **Step 3:** รันผ่าน; commit `feat: admin tools, profile, articles`

### Task 19: ล้างรูปค้าง

**Files:** Create `src/app/api/cron/cleanup-evidence/route.ts`, `vercel.json`; Test `src/app/api/cron/cleanup-evidence/route.test.ts`

**Interfaces:**
- Produces: `GET /api/cron/cleanup-evidence` ต้องมีหัว `Authorization: Bearer ${CRON_SECRET}`; ลบไฟล์ใน bucket evidence ที่ไม่มี submission อ้างถึงและเก่าเกิน 24 ชม. ผ่าน Storage API ด้วย `createAdminClient`; คืน `{deleted:number}`; ตั้ง cron วันละครั้ง (ตรวจเงื่อนไข cron ของแพ็กเกจ Vercel ตอนทำ spec §8.4)

- [ ] **Step 1:** เทสต์: ไม่มี secret → 401; ไฟล์ที่มี submission ผูกอยู่ไม่ถูกลบแม้เก่ากว่า 24 ชม.; ไฟล์ค้างอายุ 25 ชม. ถูกลบ; ไฟล์ค้างอายุ 1 ชม. ไม่ถูกลบ
- [ ] **Step 2:** รันต้องล้ม; implement; รันผ่าน; commit `feat: orphan evidence cleanup`

**เกณฑ์จบเฟส 3:** ทุกหน้าใน spec §9 ใช้งานได้

---

# ก.พ.: สาธิต

### Task 20: Seed, บัญชีสาธิต, e2e เต็มเส้นทาง, เช็กลิสต์

**Files:** Create `supabase/seed/{seed.ts,reset-demo.ts,purge-users.ts}`, `tests/e2e/full-flow.spec.ts`, `docs/demo-checklist.md`

**Interfaces:**
- Consumes: ทุก Task ก่อนหน้า; ค่า carbon จาก Task 5 เท่านั้น
- Produces: `seed.ts` รันซ้ำได้ (idempotent): นักเรียนจำลองราว 30 (ชื่อสมมติ), กิจกรรมราว 6 (สามชนิด ทั้งจบแล้วและเปิดอยู่), ผลอนุมัติกระจาย 3 เดือน, ของรางวัลราว 8, ออเดอร์ตัวอย่าง, บทความ; บัญชีสาธิต 3 (`is_demo=true`, ยืนยันอีเมลแล้ว); `reset-demo.ts` (รัน seed ใหม่ ลบข้อมูลสาธิตเดิม); `purge-users.ts` (ลบผู้ใช้ที่ไม่ใช่ admin จริง) ทั้งสองสคริปต์ปฏิเสธรันถ้า `NODE_ENV`/URL ชี้โปรเจกต์ทดสอบผิดตัวตามตัวแปร `CONFIRM_PROJECT_REF` ที่ต้องตรงกัน

- [ ] **Step 1:** เทสต์ `seed.ts` รัน 2 ครั้งติดกันได้จำนวนแถวเท่าเดิม; `reset-demo.ts` ไม่แตะ admin จริง; ไม่มีชื่อจริงของคนใน seed
- [ ] **Step 2:** รันต้องล้ม; implement สคริปต์; รันผ่าน
- [ ] **Step 3:** Playwright `full-flow.spec.ts` ตามสคริปต์ spec §13.3: สมัคร → เข้าร่วม → ครูออกรหัส → ส่งผล → ครูอนุมัติ (เห็นแจ้งเตือน) → แลกของ → ดาวน์โหลดใบเสร็จ → ครูยืนยันรับ
- [ ] **Step 4:** เขียน `docs/demo-checklist.md` ตาม spec §13.3: เปิดเว็บก่อนวัน 1-2 วัน (กันโปรเจกต์ถูกพัก ตรวจ pricing ซ้ำ), ทดสอบอีเมลด้วยบัญชีภายนอก, รัน reset, ทดสอบ QR หลายเครื่อง, วิดีโอสำรอง, ฮอตสปอต, สลับปิดการยืนยันอีเมลถ้าจำเป็น, เปลี่ยนรหัสบัญชีสาธิตหลังนำเสนอ
- [ ] **Step 5:** ทดลองกับเพื่อนในห้อง 5-10 คนบนมือถือจริง บันทึกบั๊กและแก้ก่อน **ล็อกฟีเจอร์ราว 15 ก.พ.**
- [ ] **Step 6:** commit `feat: demo seed, e2e, checklist`

---

## ฟีเจอร์เสริม (ทำเมื่อเวลาเหลือ ไม่อยู่ในแผนหลัก)

ตรวจรูปซ้ำด้วยแฮช, อันดับรายห้อง, เทียบ carbon เป็นต้นไม้, โหมด C (spec §12) แต่ละอย่างเป็นแผนย่อยแยก ไม่แตะแกนหลัก
