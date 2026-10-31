# Green Campus: รอบปรับที่สาม (บัญชี, navbar ทุกหน้า, ค้นหา/แบ่งหน้า บทความและกิจกรรม)

> สถานะ: ใช้งานแล้ว บน branch redesign-3 · branch `redesign-3` (แตกจาก `redesign-2` ที่ 6c632d5) · brainstorming 29 ต.ค. 2026
> ต่อยอดจาก `docs/DESIGN-2.md` (token, component, หน้าแรก) ทุกอย่างที่ไม่ได้เขียนในไฟล์นี้ให้ยึด DESIGN-2
> mockup ที่เจ้าของผ่านแล้ว: `.superpowers/brainstorm/476-1793207552/content/shell-and-lists-v3.html` (A–H, gitignored)

---

## 1. ข้อห้ามและข้อยกเว้น

### 1.1 ยังห้ามเหมือนเดิม

- ห้าม stage/commit: `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`, `.agents/`, `.claude/`, `skills-lock.json` · stage ทีละ path เท่านั้น ห้าม `commit -a` / `add -A` / `add .`
- ห้ามเพิ่ม dependency, ห้าม `npm --force` / `--legacy-peer-deps`
- ห้ามแก้ migration และไฟล์ pgTAP ที่มีอยู่แล้ว
- ห้ามเปลี่ยนข้อความปุ่ม/ป้าย/เมนู/`data-testid`/aria เดิม นอกจากที่ระบุใน §1.3
- ทุกงานรัน gate เต็มตาม HANDOFF §9 ก่อน commit
- ห้าม merge หรือ push จนกว่าเจ้าของสั่ง
- หน้า `/staff/**` คง chrome เดิม (header, sidebar, drawer) ไม่ใช้ `SiteHeader`/`SiteFooter`

### 1.2 ข้อยกเว้นฐานข้อมูลและ logic (เจ้าของอนุมัติ 29 ต.ค. 2026)

- เพิ่ม migration ใหม่ตั้งแต่ `0027` เป็นต้นไป และไฟล์ pgTAP ใหม่ได้ ตาม §7
- แก้ `src/lib/**`, `src/app/actions/**`, `src/app/auth/**` ได้เท่าที่งานใน spec นี้ต้องใช้
- `/` และ `/articles` เปลี่ยนจาก ○ เป็น ◐ (partial prerender) ได้ เพราะ navbar อ่าน session ใน `<Suspense>` (§3.2) แต่ส่วนอื่นต้องยังอยู่ใน static shell ห้ามเป็น ƒ ทั้งหน้า

### 1.3 ข้อความที่เปลี่ยน/เพิ่มได้ (เฉพาะที่ระบุ)

| ที่ | ข้อความ |
|---|---|
| navbar ยังไม่เข้าสู่ระบบ | ลิงก์ "เข้าสู่ระบบ" (แทน "เข้าสู่ระบบ / หน้าของฉัน"), ปุ่ม "สมัครสมาชิก" (มีอยู่แล้ว) · ลิงก์ "บทความ" ใน header สาธารณะเอาออก (ยังอยู่ในเมนูกลางเมื่อเข้าสู่ระบบ และใน footer) |
| navbar เข้าสู่ระบบแล้ว | เมนูกลาง "หน้าหลัก กิจกรรม ผลที่ส่ง รางวัล อันดับ บทความ" (เอา "ฉัน" ออก) · ปุ่มรูปโปรไฟล์ aria "เมนูบัญชี" · ในเมนู "โปรไฟล์", "ออกจากระบบ" (เดิม) และสำหรับครู/admin "หน้าผู้ดูแล" |
| แถบล่างมือถือ | 4 ปุ่ม "หน้าหลัก กิจกรรม รางวัล แจ้งเตือน" (เอา "ฉัน" ออก) |
| หน้าเข้าสู่ระบบ | คำอธิบาย "เข้าสู่ระบบเพื่อร่วมกิจกรรม ส่งผล และสะสมแต้มแลกรางวัล" · "หรือ" · "เข้าสู่ระบบด้วย Google" · "ยังไม่มีบัญชี?" + "สมัครสมาชิก" |
| หน้าสมัครสมาชิก | คำอธิบาย "สมัครสมาชิกเพื่อเริ่มสะสมแต้มจากกิจกรรมรักษ์โลก" · "หรือ" · "สมัครสมาชิกด้วย Google" · "มีบัญชีแล้ว?" + "เข้าสู่ระบบ" |
| ปุ่ม Google (ทั้งสองหน้า) | ข้อความหลังกด "ยังไม่เปิดให้ใช้งาน" |
| ช่องรหัสผ่าน | aria ปุ่มลูกตา "แสดงรหัสผ่าน" / "ซ่อนรหัสผ่าน" |
| โปรไฟล์ | หัวข้อ "รูปโปรไฟล์", "อีเมล", "รหัสผ่าน" · ปุ่ม "อัปโหลดรูป", "ลบรูป", "เปลี่ยนอีเมล", "เปลี่ยนรหัสผ่าน" · ป้าย "อีเมลปัจจุบัน", "อีเมลใหม่", "รหัสผ่านปัจจุบัน", "รหัสผ่านใหม่" · ลิงก์ "ลืมรหัสผ่าน?" (เดิม) · ข้อความ §4.3/§4.4 · ข้อความแจ้งหลังขอเปลี่ยนอีเมล (`?email=pending`, Ruling T3a) "ยืนยันอีเมลหนึ่งฉบับแล้ว กรุณากดลิงก์ยืนยันในอีเมลอีกฉบับเพื่อเปลี่ยนอีเมลให้เสร็จ" · "เปลี่ยนอีเมลแล้ว" / "ลิงก์ยืนยันใช้ไม่ได้หรือหมดอายุ ลองขอใหม่อีกครั้ง" (`?email=changed` / `?email=link-error`) · section ธีมเอาออก |
| dashboard | คำทักทาย §4.5 |
| รายการ | placeholder "ค้นหากิจกรรม" / "ค้นหาบทความ" · ป้าย "เรียง", ตัวเลือก "ใหม่ → เก่า", "เก่า → ใหม่" · aria "การ์ด", "รายการ", "แบ่งหน้า" (aria-label ของ nav pagination), "หน้าก่อน", "หน้าถัดไป", "หน้า N" · "ไม่พบกิจกรรมที่ตรงกับคำค้น" / "ไม่พบบทความที่ตรงกับคำค้น" · "ล้างการค้นหา" · ป้าย "เข้าร่วมแล้ว" |
| รายละเอียด | "โดย {ชื่อ}" (ไม่มีชื่อ → "โดย -") · ปุ่ม "คัดลอกลิงก์" → "คัดลอกแล้ว" · ← "กิจกรรมทั้งหมด" |
| ฟอร์ม staff กิจกรรม | ป้าย "ภาพปก", "รายละเอียดกิจกรรม" (ใช้คำปุ่มอัปโหลด/ลบภาพเดียวกับฟอร์มบทความ) |

`tests/redesign/check-scope.mjs`: เพิ่มข้อความใหม่ในไฟล์ allowlist ใหม่ `tests/redesign/ui-strings-3.allow.txt`, เอา "เข้าสู่ระบบ / หน้าของฉัน", "ฉัน" (เมนู) และข้อความ section ธีมในโปรไฟล์ออกจาก baseline ได้ และเปิดพาธที่ §1.2 อนุญาต ปรับ `use-cache-count` ตามจำนวนจริงพร้อมเหตุผลใน §10

---

## 2. หน้าตา (สรุปจาก mockup ที่ผ่าน)

- **A** navbar ยังไม่เข้าสู่ระบบ: ใบไม้ + "Green Campus" (ลิงก์ `/`) · ช่องว่าง · ไอคอนธีม · ลิงก์ข้อความ "เข้าสู่ระบบ" · ปุ่ม "สมัครสมาชิก" ขวาสุด
- **B** navbar เข้าสู่ระบบแล้ว: โลโก้ · เมนูกลาง (รายการปัจจุบันพื้น `--soft` ตัวอักษร accent) · กระดิ่ง · ไอคอนธีม · รูปโปรไฟล์ 36px → dropdown กว้าง 260px: รูป 48px + ชื่อ + อีเมล, เส้นประ, "โปรไฟล์", "ออกจากระบบ" (สีแดงเดิมของปุ่มออกจากระบบ)
  - **หมายเหตุตอนปิดงาน (Ruling T4a):** คำว่า "สีแดง" ใน §2 B ผิด `SignOutButton` ใช้ซ้ำโดยไม่แก้ และ token `bg-soft` / `--soft` ไม่มีอยู่จริง จึงใช้ `accent-soft` แทนทั้งที่เมนูกลาง, ไอคอน ghost และ dropdown (ดู §3.5 ด้วย)
- ไอคอนธีมและกระดิ่ง: ไม่มีกรอบ ไม่มีเงา วงกลม 44×44 hover/focus-visible พื้น `--soft` ไอคอนสี accent
- **C/C2** หน้ารายการ: หัวข้อ · แถบเครื่องมือ (ช่องค้นหายืดเต็ม, select เรียง, ปุ่มสลับ การ์ด/รายการ) · การ์ด 3 คอลัมน์ (md+) 2 (sm) 1 (มือถือ) มีภาพปก, ป้ายประเภท, หัวข้อ, รายละเอียดสั้น 2 บรรทัด (`line-clamp-2`, ไม่มีก็ไม่แสดง), "โดย ชื่อ · ..." · รายการ: ภาพย่อ 96×64 + ข้อความเดียวกัน · pagination ทั้งสองมุมมอง
- **D** หน้ารายละเอียด: ลิงก์กลับ · ภาพปก (สูงสุด 320px, `object-cover`, มุมโค้ง) · หัวข้อ · แถว "โดย ชื่อ · วันที่" ซ้าย / "คัดลอกลิงก์" ขวา (มือถือขึ้นบรรทัดใหม่ได้) · ข้อมูล · เนื้อหา
- **E** ลิงก์ อบก.: ไอคอนลิงก์ + ข้อความขีดเส้นใต้
- **F** หน้า auth: หัวข้อ + คำอธิบาย · ป้าย "รหัสผ่าน" กับ "ลืมรหัสผ่าน?" แถวเดียวกัน · ปุ่มลูกตาในช่องมุมขวา · ปุ่มหลัก · "หรือ" มีเส้นสองข้าง · ปุ่ม Google แบบ secondary มีโลโก้ G (SVG สี่สีอินไลน์, `aria-hidden`) · ลิงก์ไปอีกหน้า
- **G** โปรไฟล์: section รูปโปรไฟล์ (รูป 72px + ปุ่ม) → ข้อมูลส่วนตัว (ฟอร์มเดิม) → อีเมล → รหัสผ่าน → ออกจากระบบ
- **H** dashboard: คำทักทาย · รูป 72px + ชื่อ-นามสกุล + อีเมล · อันดับ: รูป 28px หน้าชื่อ

ทุกหน้าใช้ token/พื้นผิวกระดาษของ DESIGN-2 · 360px ต้องไม่มี horizontal scroll · เป้ากดอย่างน้อย 44×44

---

## 3. โครงหน้า (navbar + footer)

### 3.1 ไฟล์

- `src/app/_components/site-header.tsx` ใช้ร่วมกันโดย `/` (page), `(public)`, `(auth)`, `(student)` layouts · `(student)/layout.tsx` เลิกใช้ header ของตัวเอง
- `src/app/_components/header-account.tsx` (server, async): อ่าน `getCurrentUser()` แล้ว render หนึ่งในสามแบบ
- `src/app/_components/account-menu.tsx` (client): ปุ่มรูป + dropdown
- `src/app/_components/main-nav.tsx` (client): เมนูกลางของนักศึกษา ไฮไลต์ด้วย `usePathname()` ใน `<Suspense>` ตามแบบ `student-nav.tsx` เดิม · แถบล่างมือถือยังอยู่ใน `student-nav.tsx` (4 ปุ่ม)
- `src/app/_components/site-footer.tsx` ใช้ใน layout เดียวกับ header

### 3.2 การอ่าน session

- `SiteHeader` เป็น server component ที่ไม่อ่าน session เอง ส่วนขวา (และเมนูกลาง) อยู่ใน `<Suspense fallback={<HeaderAccountSkeleton/>}>` ซึ่งเป็นกล่องว่างกว้างเท่าแบบยังไม่เข้าสู่ระบบ (ไม่มีข้อความ, `aria-hidden`) กัน layout shift
- ทุกอย่างนอก Suspense นั้นยัง prerender ได้ · `/` และ `/articles` เป็น ◐ หลัง build
- สามแบบ:
  1. `null` → ไอคอนธีม, "เข้าสู่ระบบ" → `/login`, "สมัครสมาชิก" → `/register`
  2. `student` → เมนูกลาง, กระดิ่ง (`/notifications`, md+ เท่านั้น มือถือใช้แถบล่าง), ไอคอนธีม, `AccountMenu` (โปรไฟล์ → `/profile`)
  3. `teacher`/`admin` → ไอคอนธีม, `AccountMenu` (หน้าผู้ดูแล → `/staff`, โปรไฟล์ → `/staff/profile`)
- มือถือ (< md): เมนูกลางซ่อน · แถบล่างแสดงเฉพาะใน `(student)` layout เหมือนเดิม · "Green Campus" เป็น sr-only ที่ < 440px (Ruling T9a เดิม)

### 3.3 AccountMenu

- ปุ่ม 44×44 แสดง `Avatar` 36px, `aria-label="เมนูบัญชี"`, `aria-expanded`, `aria-controls`
- เปิด: แผงใต้ปุ่ม ชิดขวา · ปิดด้วย Esc (โฟกัสกลับปุ่ม), คลิกนอก, เลือกลิงก์, เปลี่ยน path
- ข้างใน: `Avatar` 48px, ชื่อ (`displayName ?? fullName`), อีเมล (ตัดด้วย `truncate`), ลิงก์, `SignOutButton` เดิม
- ไม่ใช้ `role="menu"` (เป็น disclosure ธรรมดา ลิงก์กด Tab ได้ตามลำดับ)

### 3.4 Footer และลิงก์

- `SiteFooter` แสดงทุกหน้า ยกเว้น `/staff/**` · ใน `(student)` footer อยู่เหนือ padding ของแถบล่าง
- `social-links.ts`: ทั้ง 5 รายการ (Facebook, LINE, Instagram, X, YouTube) มี `href: "/"` ชั่วคราว และ `visibleSocialLinks()` คืนทั้ง 5 · เจ้าของแก้ URL จริงในไฟล์นี้ไฟล์เดียว · ลิงก์ที่เป็น `/` ไม่ใส่ `target="_blank"`
- ลิงก์ อบก. LESS-WM-01 v06 → `https://ghgreduction.tgo.or.th/th/calculation/less-calculate-document/less-waste/item/548-less-wm-01.html` (`target="_blank" rel="noopener noreferrer"`, ไอคอนลิงก์ SVG `aria-hidden`, ขีดเส้นใต้) ที่ `problem-section.tsx`, `facts-section.tsx`, `site-footer.tsx` · คอมโพเนนต์ `LessSourceLink` ตัวเดียว

### 3.5 ไอคอนแบบ ghost

- `ThemeToggle` และ `NotificationBell` (ไอคอน) ได้ class แบบ ghost: `rounded-full size-11 grid place-items-center hover:bg-soft hover:text-accent focus-visible:bg-soft` ไม่มี border/shadow (ใช้ `hover:bg-accent-soft` แทน `hover:bg-soft` เพราะไม่มี token `bg-soft`, Ruling T4a) · `aria-label="ธีม"` และ `aria-pressed` ของปุ่มธีมคงเดิม
- `/staff` ใช้ `ThemeToggle` ตัวเดียวกัน จึงได้แบบ ghost ด้วย (ยอมรับได้ ไม่ใช่การเปลี่ยนโครง)

---

## 4. บัญชีผู้ใช้

### 4.1 Avatar

- `src/components/ui/avatar.tsx`: `Avatar({ name, url, size: 28|36|48|72 })` · มี `url` → `<img alt="">` (ชื่ออยู่ข้างๆ เสมอ) `object-cover rounded-full` · ไม่มี → วงกลม `bg-accent text-on-accent` ตัวอักษรแรก
- `avatarInitial(name)` (lib, มี test): ตัด whitespace, ข้ามสระหน้าไทย `เ แ โ ใ ไ` แล้วคืน grapheme แรก (`Intl.Segmenter`) · ภาษาอังกฤษเป็นตัวใหญ่ · ชื่อว่าง → "?"
- `getCurrentUser()` เพิ่ม `avatarUrl: string | null` (public URL จาก bucket `avatars`)

### 4.2 อัปโหลดรูปโปรไฟล์

- `src/lib/image.ts` เพิ่ม `cropSquareToJpeg(file, { edge: 384 })` ใช้ `ImageCodec` เดิม (ขยาย codec ด้วยการวาดเฉพาะส่วนที่ตัด) ผลลัพธ์ JPEG ≤ 512 KB
- ฝั่ง client: เลือกไฟล์ → ตัด/ย่อ → upload ไป `avatars/{uid}/{uuid}.jpg` ด้วย browser client (session ผู้ใช้) → `setAvatar(path)`
- server action `setAvatar(path)` (`src/app/actions/profile.ts`): ตรวจรูปแบบ path และ prefix = uid, update `profiles.avatar_path`, ลบไฟล์เก่า (ถ้ามี และไม่ใช่ไฟล์เดียวกัน), revalidate `/profile`, `/staff/profile`, `/dashboard`, `/leaderboard`
- `removeAvatar()`: ตั้ง `avatar_path = null` แล้วลบไฟล์
- error ภาษาไทยผ่าน `errorMessageTh` เดิม (`not_image`, `image_too_large`) + ข้อความทั่วไป

### 4.3 เปลี่ยนอีเมล

- server action `changeEmail({ newEmail, currentPassword })`:
  1. ต้องเข้าสู่ระบบ · ตรวจรูปแบบอีเมล (ใช้ validation ของหน้าสมัคร) และไม่ซ้ำกับอีเมลเดิม
  2. ตรวจรหัสผ่านด้วย `verifyPassword(email, password)` ที่สร้าง anon client แยก (`persistSession: false`, ไม่มี cookie) แล้ว `signInWithPassword` · ผิด → `{ ok:false, fieldErrors:{ currentPassword:"รหัสผ่านปัจจุบันไม่ถูกต้อง" } }`
  3. `supabase.auth.updateUser({ email }, { emailRedirectTo: <origin>/auth/callback/email })`
  4. สำเร็จ → "ส่งลิงก์ยืนยันแล้ว กรุณากดยืนยันในอีเมลทั้งเก่าและใหม่ อีเมลจะเปลี่ยนเมื่อยืนยันครบ"
- `email-links.ts`: เพิ่ม flow `email` → path `/auth/callback/email`, success `/profile?email=changed`, failure `/profile?email=link-error` · route ใหม่ `src/app/auth/callback/email/route.ts` ใช้ `handleAuthCallback` · ครู/admin ที่ไป `/profile` ถูกส่งต่อ `/staff/profile` อยู่แล้ว ต้องส่ง query ต่อไปด้วย
- หน้าโปรไฟล์อ่าน `?email=` แล้วแสดงข้อความ "เปลี่ยนอีเมลแล้ว" / "ลิงก์ยืนยันใช้ไม่ได้หรือหมดอายุ ลองขอใหม่อีกครั้ง"
- **หมายเหตุตอนปิดงาน:** GoTrue ในเครื่องส่งลิงก์ยืนยันแรกของการเปลี่ยนอีเมลสองฝั่งกลับมาพร้อม `#message=` ใน URL fragment · `EmailNotice` อ่าน fragment ฝั่ง client แล้วแสดงข้อความ pending · ส่วนรูป query `?message=` จะ redirect ฝั่ง server ไป `?email=pending`
- `supabase/config.toml` เพิ่ม `/auth/callback/email` ใน `additional_redirect_urls`

### 4.4 เปลี่ยนรหัสผ่าน

- server action `changePassword({ currentPassword, newPassword })`: ต้องเข้าสู่ระบบ · ความยาวตามกฎหน้าสมัคร/ตั้งรหัสใหม่เดิม · ใหม่ต้องไม่เท่าเดิม · `verifyPassword` · `updateUser({ password })` · สำเร็จ "เปลี่ยนรหัสผ่านแล้ว" และล้างช่อง
- ป้าย "รหัสผ่านปัจจุบัน" มีลิงก์ "ลืมรหัสผ่าน?" → `/forgot-password` แถวเดียวกัน
- ทุก error ที่ไม่ได้คาด → `GENERIC_ERROR_TH` · ไม่ log รหัสผ่าน

### 4.5 คำทักทาย dashboard

- `greetingFor(date): string` (lib, test ทุกขอบ) ตามเวลา Asia/Bangkok: 05:00–10:59 "สวัสดีตอนเช้า" · 11:00–12:59 "สวัสดีตอนเที่ยง" · 13:00–16:59 "สวัสดีตอนบ่าย" · 17:00–04:59 "สวัสดีตอนเย็น"
- ชื่อ: `displayName` ถ้ามี ไม่งั้นคำแรกของ `fullName`
- dashboard อ่าน session อยู่แล้ว (dynamic) · อ่านเวลาหลัง `getCurrentUser()` (หลัง `connection()`)
- ใต้คำทักทาย: `Avatar` 72px + ชื่อ-นามสกุล (`fullName`) + อีเมล

### 4.6 หน้าเข้าสู่ระบบ/สมัครสมาชิก

- `src/components/ui/password-input.tsx` (client): input + ปุ่มลูกตา 44×44 ภายในขอบขวา (`aria-pressed`, `aria-controls`, aria ตาม §1.3) · ใช้ในเข้าสู่ระบบ, สมัคร, ตั้งรหัสใหม่, และฟอร์มอีเมล/รหัสผ่านในโปรไฟล์ · ชื่อ field/`autocomplete`/`data-testid` เดิมคงไว้
- "ลืมรหัสผ่าน?" ย้ายไปแถวป้ายรหัสผ่าน (flex justify-between) · ลบตำแหน่งเดิม
- `GoogleButton({ label })` (client): `type="button"`, กดแล้วแสดง "ยังไม่เปิดให้ใช้งาน" ใน `role="status"` ใต้ปุ่ม · ไม่เรียก auth

### 4.7 หน้าโปรไฟล์

- `account-sections.tsx` (ใช้ทั้ง `/profile` และ `/staff/profile`): เอา section ธีมออก · ลำดับตาม §2 G
- ฟอร์มอีเมล/รหัสผ่านเป็น client form แบบเดียวกับ `profile-form.tsx` เดิม (สถานะกำลังบันทึก, error ต่อช่อง, ข้อความสำเร็จ `role="status"`)

---

## 5. บทความ

### 5.1 รายการ `/articles`

- query params: `q` (≤ 100 ตัว, trim), `sort` = `new`|`old` (default `new`), `view` = `card`|`list` (default `card`), `page` ≥ 1 (default 1) · `parseListParams(searchParams)` คืนค่าที่ถูกต้องเสมอ ค่าผิดรูป → default
- `listPublishedArticlesPage({ q, sort, page })` (`'use cache'`, `cacheTag(ARTICLES_TAG)`, anon client): `.eq("published", true)`, ค้นหา `title` หรือ `body` ilike `%q%` (escape `\ % _` และใส่ค่าใน `"..."` ของ `.or()` โดย escape `"` และ `\`), order `created_at` + `id` ตาม sort, `.range()` 12 ต่อหน้า, `count: "exact"` · คืน `{ items, total }` หรือ `null` (cacheLife "seconds") · ถ้า `page` เกินหน้าสุดท้าย หน้า (นอก cache) เรียกซ้ำด้วยหน้าสุดท้าย · total = 0 → สถานะว่าง
- หน้า: หัวข้ออยู่ใน static shell · `ListToolbar` เป็น client ที่อ่านค่าเริ่มด้วย `useSearchParams()` อยู่ใน `<Suspense>` ของตัวเอง (fallback = toolbar ค่าว่าง ขนาดเท่าเดิม) · รายการ + pagination อยู่ใน `<Suspense>` อีกอันที่ await `searchParams`
- **หมายเหตุตอนปิดงาน (Ruling T7a):** อักขระ `*` ในคำค้นจับแบบตรงตัวไม่ได้ PostgREST แปลง `*` เป็น `%` ในค่า like และไม่มีทาง escape จึงแปลง `*` เป็น `_` (wildcard หนึ่งตัวอักษร) · ไม่ทำให้ error
- การ์ด/แถว: ภาพปก (ไม่มี → พื้นผิวกระดาษ kraft + ใบไม้) · หัวข้อ · excerpt เดิม · "โดย ชื่อ · วันที่"
- ชื่อผู้เขียน: เก็บ `author_id` ของหน้า แล้ว `staff_names()` ครั้งเดียวต่อหน้า (ใน cache เดียวกัน) · ไม่พบ → "-"
- section บทความในหน้าแรกไม่เปลี่ยน

### 5.2 `/articles/[slug]`

- ลำดับ §2 D · `getPublishedArticle` คืน `authorName: string | null` เพิ่ม
- `CopyLinkButton` (client, `src/components/ui/copy-link-button.tsx`): `navigator.clipboard.writeText(location.href)` → "คัดลอกแล้ว" 2 วินาที (`role="status"`) · ล้มเหลว → แสดง input readonly ที่ select URL ให้
- proxy 404 / `instant = false` / metadata เดิมคงไว้

### 5.3 component รายการที่ใช้ร่วมกัน (`src/app/_components/list/`)

- `list-params.ts` (`parseListParams`, `listHref(base, params, patch)`, `PAGE_SIZE = 12`) + test
- `list-toolbar.tsx`: `<form method="get" role="search">` ช่องค้นหา (`type="search"`, label sr-only ตาม placeholder) + hidden `sort`/`view` · select เรียงเปลี่ยนแล้ว `router.replace(listHref(...))` (ไม่มี JS: ปุ่ม submit sr-only เปิดเผยเมื่อ focus) · เปลี่ยนคำค้น/เรียง → page กลับเป็น 1
- `view-toggle.tsx`: ลิงก์สองอัน `aria-label` "การ์ด"/"รายการ", `aria-current="true"` อันที่เลือก
- `pagination.tsx`: `<nav aria-label="แบ่งหน้า">` ลิงก์ก่อน/ถัดไป + เลขหน้า (แสดง 1, …, ปัจจุบัน±1, …, สุดท้าย) · `aria-current="page"` · ซ่อนเมื่อมีหน้าเดียว
- `search-escape.ts` (`toIlikePattern`, `quoteOrValue`) + test

---

## 6. กิจกรรม

### 6.1 ฝั่ง staff

- `activity-form`: เพิ่ม "ภาพปก" (อัปโหลด/เปลี่ยน/ลบ แบบเดียวกับ `article-form.tsx`, path `{activity id}/{uuid}.jpg` ใน `activity-images`) และ "รายละเอียดกิจกรรม" (textarea, ≤ 20,000 ตัว, มีตัวนับ)
- `validation.ts`: `detailsMax: 20000`, `cover_path` ตรวจรูปแบบ · action สร้าง/แก้ไขบันทึกค่าใหม่ · กิจกรรมใหม่: สร้างแถวก่อนแล้วอัปโหลดภาพ (ตามลำดับเดียวกับบทความ) · ลบภาพเก่าเมื่อเปลี่ยน/ลบ · ลบกิจกรรม → ลบภาพด้วย
- `revalidateTag`/`updateTag` ของ feed หน้าแรกเมื่อกิจกรรมเปลี่ยน (ถ้ามี tag อยู่แล้วใช้ตัวเดิม)

### 6.2 รายการ `/activities`

- รายการเดียว (เปิดรับ + ที่เคยเข้าร่วม ตาม RLS เดิม) ป้าย "เข้าร่วมแล้ว" ที่การ์ด · ป้ายสถานะเดิม (`statusLabelTh`) คงไว้
- `listActivitiesForStudentPage(userId, { q, sort, page })`: เงื่อนไขเดิม (`status.eq.open` หรือ `id in joined`) **และ** ค้นหา `title`/`description` · order `created_at` + `id` · range + count · ใช้ session ผู้ใช้ (dynamic อยู่แล้ว)
- การ์ด: ภาพปก + ป้ายประเภท · หัวข้อ · `description` 2 บรรทัด (ไม่มีก็ไม่แสดง) · "โดย ชื่อ · เหลือ N วัน" + แถบความคืบหน้า (`activityProgress` เดิม) · ทั้งการ์ดเป็นลิงก์ไป `/activities/[id]`
- ว่างทั้งหมด → ข้อความเดิม "ยังไม่มีกิจกรรมที่เปิดรับ ลองกลับมาดูใหม่ภายหลัง" · ค้นแล้วไม่พบ → §1.3

### 6.3 `/activities/[id]`

- ลำดับ §2 D: ภาพปก → หัวข้อ → "โดย ชื่อ · วันที่สร้าง" / `CopyLinkButton` → ข้อมูลเดิม (ช่วงเวลา, สถานที่, แต้ม ฯลฯ) → `details` (แยกย่อหน้าด้วย `splitParagraphs` เดิม) → ปุ่มเข้าร่วม/ส่งผลเดิม
- `getActivity` คืน `cover_path`, `details`, `created_by`, `created_at` เพิ่ม · ชื่อผ่าน `staff_names()`

### 6.4 หน้าแรก

- `home_open_activities` คืน `cover_path` เพิ่ม (§7.4) · `activities-section.tsx` แสดงภาพปกบนการ์ด (ไม่มี → พื้นผิวเดิม) · ยัง `'use cache'` และ anon

---

## 7. ฐานข้อมูล

ทุกฟังก์ชันใหม่: `security definer`, `stable`, `set search_path = ''`, `revoke execute ... from public` แล้ว `grant` ให้ role ที่ระบุเท่านั้น

### 7.1 `0027_avatars.sql`

- `alter table public.profiles add column avatar_path text` + constraint `profiles_avatar_path_format`: null หรือ `^<uuid>/<uuid>\.jpg$` และ `split_part(avatar_path,'/',1) = id::text`
- `grant update (avatar_path) on public.profiles to authenticated` (RLS `profiles_update_own` เดิมจำกัดแถวของตัวเอง)
- bucket `avatars`: public, `file_size_limit` 524288, `allowed_mime_types` `{image/jpeg}`
- policy `storage.objects` สำหรับ `authenticated`: select ใน bucket นี้ · insert/update/delete เมื่อ `(storage.foldername(name))[1] = (select auth.uid())::text`
- `leaderboard(p_period, p_now)`: drop แล้ว create ใหม่ (นิยามล่าสุดใน migration ก่อนหน้า) เพิ่มคอลัมน์ผลลัพธ์ `avatar_path text` ท้ายสุด · ตรรกะ/สิทธิ์/grant เหมือนเดิมทุกอย่าง

### 7.2 `0028_activity_content.sql`

- `activities` เพิ่ม `cover_path text` (รูปแบบเดียวกับ `articles_cover_path_format` และ prefix = id) และ `details text` (`char_length(details) <= 20000`)
- column grants: ถ้า `activities` ใช้ column-level grant ให้เพิ่มสองคอลัมน์ให้ staff ตามแบบเดิม
- bucket `activity-images`: public, 2097152, `{image/jpeg,image/png,image/webp}` · policy แบบ `article-images` (select authenticated, insert/update/delete `is_staff()`)

### 7.3 `0029_staff_names.sql`

- `staff_names(p_ids uuid[]) returns table (id uuid, name text)`: คืน `coalesce(nullif(trim(display_name),''), full_name)` เฉพาะ `role in ('teacher','admin')` และ `id = any(p_ids)` · จำกัด `cardinality(p_ids) <= 100` (เกิน → ตัด) · grant `anon`, `authenticated`

### 7.4 `0030_home_feed_cover.sql`

- **หมายเหตุตอนปิดงาน (Ruling T1a):** ฟังก์ชันของ 0026 จริงๆ ชื่อ `public_open_activities` และ test เดิมตรึงคอลัมน์ไว้ 0030 จึงเพิ่มฟังก์ชันใหม่ `home_open_activities(p_limit)` ที่มี `cover_path` ส่วนฟังก์ชันเดิมไม่แตะ (ข้อความข้างล่างอ่านตามนี้)
- `home_open_activities(p_limit)`: drop + create คืนคอลัมน์เดิม + `cover_path text` ท้ายสุด · เงื่อนไข/clamp/grant เดิม (DESIGN-2 §7.1)

### 7.5 pgTAP (ไฟล์ใหม่)

- `avatars.test.sql`: format check (path ของคนอื่น, ไม่ใช่ .jpg → fail) · update ได้เฉพาะแถวตัวเอง · anon update ไม่ได้ · policy storage (insert โฟลเดอร์ตัวเองได้, ของคนอื่นไม่ได้) · `leaderboard` คืน `avatar_path` และผลเดิม (rank, is_me) ไม่เปลี่ยน
- `activity_content.test.sql`: `details` เกิน 20000 fail · cover_path prefix ผิด fail · student เขียน `activity-images` ไม่ได้, staff ได้
- `staff_names.test.sql`: anon/authenticated เรียกได้ · id นักศึกษาไม่คืน · display_name ว่าง → full_name · id ไม่มีอยู่ → ไม่คืน
- `public_home_feed.test.sql` เดิมห้ามแก้ → เพิ่ม `home_feed_cover.test.sql` ทดสอบ `cover_path`

---

## 8. การทดสอบ

- **gate** HANDOFF §9 ครบ (หลัง `npx supabase db reset`) + `node tests/redesign/check-scope.mjs` + build: `/` และ `/articles` เป็น ◐
- **vitest**: `avatarInitial`, `greetingFor`, `parseListParams`/`listHref`, `toIlikePattern`/`quoteOrValue`, `cropSquareToJpeg` (codec จำลอง), validation อีเมล/รหัสผ่าน/กิจกรรม (`details`, `cover_path`), `email-links` flow ใหม่, `visibleSocialLinks` (5 รายการ href `/`), render test `HeaderAccount` ทั้งสามแบบ, `Pagination` (ช่วงเลขหน้า, หน้าเดียวซ่อน), `Avatar` (รูป/ตัวอักษร)
- **e2e** (chromium + mobile-chrome):
  - navbar: anon เห็น "เข้าสู่ระบบ" + "สมัครสมาชิก" ไม่มีเมนูกลาง · นักศึกษาเห็นเมนูกลาง 6 รายการ ไม่มี "ฉัน" · ครูเห็น "หน้าผู้ดูแล" ใน dropdown · dropdown เปิด/Esc ปิดโฟกัสกลับ/ออกจากระบบได้ · โลโก้ไป `/`
  - header ยังอยู่ top 0 หลังเลื่อน และมี footer ที่ `/`, `/articles`, `/login`, `/dashboard`, `/activities`, `/profile` · `/staff` ไม่มี `SiteFooter`
  - ลิงก์ อบก. มี href ทางการ
  - ลูกตา: type password ↔ text · Google: ขึ้น "ยังไม่เปิดให้ใช้งาน" และ URL ไม่เปลี่ยน · "ลืมรหัสผ่าน?" อยู่แถวเดียวกับป้าย
  - โปรไฟล์: ไม่มี section ธีม · อัปโหลดรูป → navbar/dashboard แสดง `<img>` · ลบรูป → ตัวอักษร · เปลี่ยนรหัสผ่าน (ผิด → error, ถูก → เข้าสู่ระบบด้วยรหัสใหม่ได้) · เปลี่ยนอีเมล (ผิด → error, ถูก → ข้อความส่งลิงก์ + มีอีเมลใน Mailpit)
  - dashboard: คำทักทายหนึ่งในสี่แบบ (ใช้ `page.clock` กำหนดเวลา) + ชื่อ-นามสกุล + อีเมล · อันดับ: มีรูป/ตัวอักษรหน้าชื่อ
  - บทความและกิจกรรม: seed 13 รายการ → หน้า 2 มี 1 รายการ · ค้นหาคำที่มีอยู่/ไม่มีอยู่ · เรียงเก่า → ใหม่ · สลับรายการ (URL `view=list`) · อักขระพิเศษในคำค้น (`%`, `,`, `"`) ไม่ทำให้ error · คัดลอกลิงก์ (grant clipboard permission ใน chromium)
  - กิจกรรม: staff ใส่ภาพปก + รายละเอียด → นักศึกษาเห็นที่การ์ดและหน้ารายละเอียด + "โดย ชื่อครู" · หน้าแรกการ์ดมีภาพปก
  - 360px ไม่มี horizontal scroll ที่หน้าที่เปลี่ยนทั้งหมด · ไม่มี id ซ้ำหลังสลับหน้า (`<Activity>`)
- test เดิมที่อิงข้อความ "เข้าสู่ระบบ / หน้าของฉัน", เมนู "ฉัน", section ธีมในโปรไฟล์, สองกลุ่มในหน้ากิจกรรม ปรับตาม spec นี้

---

## 9. ลำดับงาน (รายละเอียดในแผน)

1. migration 0027–0030 + pgTAP + check-scope (§1.2/§1.3)
2. `Avatar` + `getCurrentUser().avatarUrl` + อัปโหลด/ลบรูปในโปรไฟล์
3. เปลี่ยนอีเมล/รหัสผ่าน + callback อีเมล + เอา section ธีมออก
4. `SiteHeader`/`SiteFooter` ทุกหน้า + `AccountMenu` + แถบล่าง 4 ปุ่ม + ไอคอน ghost + ลิงก์ อบก. + social `/`
5. หน้าเข้าสู่ระบบ/สมัคร (`PasswordInput`, `GoogleButton`, คำอธิบาย)
6. dashboard (คำทักทาย + รูป) + อันดับ (รูป)
7. component รายการที่ใช้ร่วม + บทความ (รายการ + รายละเอียด + `CopyLinkButton`)
8. กิจกรรม (ฟอร์ม staff + รายการ + รายละเอียด + การ์ดหน้าแรก)
9. รีวิวรวม + Impeccable audit/polish + บันทึกผลใน §10

## 10. ผลตรวจ build ปิดงาน

ปิดงาน 31 ต.ค. 2026 (Task 9) · gate เต็มหลัง `npx supabase db reset` (e2e รันหลัง reset อีกรอบทันที)

| ขั้น | ผล |
|---|---|
| `npx supabase test db` (pgTAP) | 1080 ผ่าน (27 ไฟล์) |
| `npm test` (vitest) | 757 ผ่าน (58 ไฟล์) |
| `npm run test:e2e` | 264 ผ่าน, ข้าม 14, ไม่ผ่าน 0 |
| `npm run test:seed` | 12 ผ่าน |
| `npm run test:e2e:prod` | 39 ผ่าน, ข้าม 1 |
| `npm run lint` | 0 error (111 warning เดิม) |
| `npx tsc -p scripts/tsconfig.json`, `npm run build` | ผ่าน |
| `node tests/redesign/check-scope.mjs` | `scope OK` |

บรรทัด build (เปลี่ยนจาก ○ เป็น ◐ ตาม §1.2):

```
┌ ◐ /                                      1m      1h
├ ◐ /activities
├ ◐ /articles
```

`use-cache-count` สุดท้าย = **9** (ฐานเดิมของ redesign-2 คือ 8): เพิ่มหนึ่งตัวที่ `listPublishedArticlesPage` (รายการบทความที่แบ่งหน้า/ค้นหาได้, §5.1) · baseline ใน check-scope บันทึกเป็น 9

**ปัญหาที่ทราบ (known issues):** `tests/e2e/theme.spec.ts` "toggle still flips when localStorage throws" ไม่นิ่งบน mobile-chrome และไม่นิ่งอยู่ก่อนแล้วบน base commit (Ruling T8b) · ใน e2e รอบเต็มของ Task 9 ผ่าน ไม่เจอความล้มเหลว แต่ยังถือว่าเป็นปัญหาที่ทราบ ไม่ได้แก้

**Impeccable audit/polish (Task 9):** ตรวจ `/`, `/articles`, `/articles/[slug]`, `/login`, `/register`, `/dashboard`, `/activities`, `/activities/[id]`, `/leaderboard`, `/profile`, `/staff/activities/new` · contrast ทั้งสองธีมผ่าน AA (muted 5.4–8.6:1, accent 5.7–9.9:1, on-accent 6.8–9.9:1) · focus ring ใช้ `:focus-visible` กลางของ globals.css · reduced motion มี override กลาง · id ไม่ซ้ำ (toolbar ใช้ `useId`) · เป้ากดทุกตัวใน spec ≥ 44px ยกเว้นลิงก์โลโก้ "Green Campus" เหนือการ์ดของหน้า auth ซึ่งแก้เป็น `min-h-11` (`src/app/(auth)/layout.tsx`)

## 11. สิ่งที่เจ้าของต้องทำบน Supabase Cloud

1. รัน migration 0027–0030 (`npx supabase db push` หรือวางใน SQL editor ตามลำดับ)
2. Authentication → URL Configuration → Redirect URLs เพิ่ม `https://<โดเมน>/auth/callback/email`
3. ตรวจ Authentication → Email → "Secure email change" เปิดอยู่ (ยืนยันทั้งอีเมลเก่าและใหม่)
4. ใส่ URL โซเชียลจริงใน `src/app/_components/social-links.ts` เมื่อพร้อม
