# เช็กลิสต์วันสาธิต Green Campus

เอกสารนี้ใช้กับวันนำเสนอ (spec §13.3) สำหรับเจ้าของโปรเจกต์และเพื่อนในทีม
ค่าทุกค่าในเอกสารนี้เป็นตัวอย่าง (`<...>`) ห้ามจดรหัสผ่าน, secret key หรือ connection string จริงลงไฟล์ที่เข้า git

## บัญชีและข้อมูลสาธิต

`npm run demo:reset` สร้างข้อมูลชุดเดียวกันทุกครั้ง (ลบชุดเก่าก่อน):

| บัญชี | บทบาท | ใช้ทำอะไร |
|---|---|---|
| `demo-student@seed.greencampus.example` | นักเรียน (is_demo) | มีประวัติผลที่อนุมัติแล้วและแต้มพอแลกของ 1 ชิ้น |
| `demo-teacher@seed.greencampus.example` | ครู (is_demo) | สร้างกิจกรรม ออกรหัส ตรวจผล จัดการออเดอร์ รายงาน |
| `demo-admin@seed.greencampus.example` | admin (is_demo) | หน้าผู้ใช้/อัตรา (เปลี่ยนบทบาทหรือลบ admin จริงไม่ได้ ตาม spec §8.3) |

- รหัสผ่านของทั้ง 3 บัญชีคือค่า `DEMO_PASSWORD` ที่ใส่ตอนรันสคริปต์ (อย่างน้อย 12 ตัวอักษร สคริปต์ไม่พิมพ์ค่านี้ออกมา)
- นักเรียนจำลอง 30 คน (`student01`...`student30@seed.greencampus.example`) ชื่อสมมติทั้งหมด (`scripts/demo/lib/names.ts`)
  รหัสผ่านสุ่มและไม่ได้เก็บไว้ ใช้เป็นข้อมูลเท่านั้น เข้าสู่ระบบไม่ได้
- กิจกรรม 6 รายการ ขึ้นต้นด้วย `[ตัวอย่าง] ` จบแล้ว 4 (ย้อนหลังราว 3 เดือน) เปิดอยู่ 2 (ชั่งขยะแบบใช้รหัส 1, ปลูกต้นไม้ 1)
  มีผลรอตรวจ 6 รายการและผลไม่ผ่าน 1 รายการในคิวตรวจของครู
- ของรางวัล 8 ชิ้น (ขึ้นต้นด้วย `[ตัวอย่าง] ` มี 1 ชิ้นที่ของหมด) ออเดอร์ตัวอย่างครบทุกสถานะ บทความเผยแพร่ 3 ฉบับร่าง 1
- ค่า carbon มาจากอัตราใน `waste_categories` เท่านั้น (ค่าที่เป็นค่าประมาณยังมีป้ายค่าประมาณ) กิจกรรมปลูกต้นไม้ในชุดนี้ไม่นับ carbon
  เพราะยังไม่มีค่าต่อต้นที่ตรวจสอบได้ (ดู `docs/carbon-sources.md`)

## คำสั่ง (ใช้บนเครื่องผู้ดูแล)

สคริปต์ทั้ง 3 ตัวต้องได้ `CONFIRM_PROJECT_REF` ที่ตรงกับโปรเจกต์ปลายทาง ไม่ตรงหรือไม่ได้ตั้ง = ไม่ทำอะไรเลยและจบด้วย exit 1
ref อ่านจาก `NEXT_PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`, บนเครื่อง = `local`) และต้องตรงกับ `DATABASE_URL` ด้วย

ตัวแปรที่ใช้:

| ตัวแปร | ใช้ทำอะไร | หาได้ที่ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth admin / Storage API | Supabase Dashboard > Project Settings > API (Project URL) |
| `SUPABASE_SECRET_KEY` | secret key (สร้าง/ลบผู้ใช้, ลบรูป) | Project Settings > API Keys > Secret keys |
| `DATABASE_URL` | เขียนข้อมูลผ่าน Postgres (ใน transaction) | ปุ่ม **Connect** ด้านบนของ Dashboard > Connection string > **Session pooler** (`postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres`) รหัสผ่านฐานข้อมูลตั้งใหม่ได้ที่ Project Settings > Database |
| `DEMO_PASSWORD` | รหัสผ่านบัญชีสาธิต 3 บัญชี (seed/reset เท่านั้น) | ตั้งเอง อย่างน้อย 12 ตัวอักษร |
| `CONFIRM_PROJECT_REF` | ยืนยันว่าตั้งใจรันกับโปรเจกต์นี้ | `<ref>` จาก Project URL |

- สคริปต์อ่าน `.env.local` ด้วย แต่ค่าที่ตั้งใน shell มาก่อนเสมอ บน Cloud ให้ตั้ง `NEXT_PUBLIC_SUPABASE_URL` และ
  `SUPABASE_SECRET_KEY` ของโปรเจกต์ Cloud ใน shell (ไม่ต้องแก้ `.env.local` ที่ชี้เครื่องตัวเอง)
- `CONFIRM_PROJECT_REF` อ่านจาก shell เท่านั้น (ใส่ใน `.env.local` ไม่มีผล) ต้องพิมพ์ใหม่ทุกครั้งที่จะรัน
- ใช้ **Session pooler** (พอร์ต 5432) ไม่ใช้ Transaction pooler (6543) ส่วน Direct connection (`db.<ref>.supabase.co`) ของแพ็กเกจฟรีเป็น IPv6 อาจต่อจากบ้าน/ฮอตสปอตไม่ได้
- ปิดหน้าต่าง terminal หลังรันเสร็จ (ค่าใน shell หายไปด้วย)

PowerShell (Windows):

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://<ref>.supabase.co"
$env:SUPABASE_SECRET_KEY = "<secret key>"
$env:DATABASE_URL = "postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$env:CONFIRM_PROJECT_REF = "<ref>"
$env:DEMO_PASSWORD = "<รหัสผ่านบัญชีสาธิต อย่างน้อย 12 ตัว>"

npm run demo:purge              # dry run: แสดงจำนวนที่จะลบเท่านั้น ไม่ลบ
npm run demo:purge -- --yes     # ลบผู้ใช้ทุกคนที่ไม่ใช่ admin จริง (role admin และ is_demo = false) พร้อมรูปหลักฐาน
npm run demo:reset              # ลบข้อมูลตัวอย่างเดิม แล้วสร้างบัญชีสาธิต 3 บัญชี + ข้อมูลตัวอย่างใหม่
```

Git Bash:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_SECRET_KEY="<secret key>"
export DATABASE_URL="postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
export CONFIRM_PROJECT_REF="<ref>" DEMO_PASSWORD="<รหัสผ่านบัญชีสาธิต>"
npm run demo:purge              # ดูจำนวนก่อน แล้วค่อยรันบรรทัดถัดไป
npm run demo:purge -- --yes
npm run demo:reset
```

ลำดับที่ใช้ก่อนวันสาธิต: `demo:purge` (ดูจำนวน) → `demo:purge -- --yes` (ถ้าต้องการล้างผู้ใช้ที่ทดลองไว้) → `demo:reset`
หลัง purge จะเหลือเฉพาะ admin จริง ผู้ใช้ที่ demo admin เคยเปลี่ยนบทบาทจึงหายไปด้วย (demo admin เปลี่ยน admin จริงไม่ได้อยู่แล้ว)
purge ไม่ยอมรันถ้าไม่มี admin จริงเหลือ

- `demo:reset` ไม่แตะผู้ใช้นอกโดเมน `@seed.greencampus.example` ถ้ามีผู้ใช้จริง (เช่นผู้ชมที่สมัครวันสาธิต) เข้าร่วมกิจกรรมตัวอย่าง
  หรือแลกของรางวัลตัวอย่างไว้ reset จะไม่ทำอะไรและบอกให้รัน `demo:purge` ก่อน
- `demo:seed` ทำงานเหมือน `demo:reset` (รันซ้ำได้ ผลเท่าเดิม)
- สคริปต์พิมพ์เฉพาะจำนวน ไม่พิมพ์อีเมล id หรือรหัสผ่าน

## ก่อนวันสาธิต 1-2 วัน

- [ ] เปิดเว็บจริงและเปิดโปรเจกต์ใน Supabase Dashboard (โปรเจกต์ฟรีถูกพักหลังไม่มีการใช้งาน 1 สัปดาห์ ถ้าถูกพักให้กดเปิดใหม่
      ระหว่างพัก pg_cron ที่ยกเลิกออเดอร์หมดอายุก็หยุดด้วย)
- [ ] ตรวจข้อจำกัดแพ็กเกจฟรีซ้ำ (spec §8.7: ฐานข้อมูล 500 MB, ไฟล์ 1 GB, การพักโปรเจกต์) ที่หน้า pricing ของ Supabase และ
      Usage ของโปรเจกต์ ตัวเลขอาจเปลี่ยนจากตอนเขียน spec
- [ ] Vercel: Project > Settings > Cron Jobs เห็นงาน `/api/cron/cleanup-orphans` และตั้ง `CRON_SECRET` แล้ว (ดู `docs/dev-notes.md`)
- [ ] ทดสอบ **สมัคร** และ **ลืมรหัสผ่าน** ด้วยอีเมลภายนอกที่ไม่ใช่สมาชิกทีม (Gmail/Outlook ของเพื่อน) ตรวจว่าอีเมลมาถึง (ดู Spam ด้วย)
      และลิงก์พากลับมาที่เว็บจริง (`NEXT_PUBLIC_SITE_URL` และ Site URL / Redirect URLs ใน Authentication > URL Configuration)
- [ ] ตรวจ rate limit ของอีเมล (Authentication > Rate Limits ต้องใช้ custom SMTP ค่าเริ่มต้นราว 30 อีเมล/ชั่วโมง) ให้พอกับจำนวนผู้ชม
      ที่จะสมัครพร้อมกัน (spec §8.6)
- [ ] รัน `demo:purge` (ถ้าต้องการ) แล้ว `demo:reset` ตามหัวข้อคำสั่งด้านบน แล้วลองเข้าสู่ระบบทั้ง 3 บัญชีสาธิต
- [ ] ตรวจ `/staff/rates` ว่าอัตรายังตรงกับ `docs/carbon-sources.md` และ `/staff/users` ว่าบทบาทผู้ใช้จริงถูกต้อง
- [ ] ทำ QR ไปที่ `https://<โดเมน>/register` แล้วลองสแกนจากมือถือหลายเครื่อง (Android/iPhone, หลายเบราว์เซอร์)
- [ ] อัดวิดีโอสำรอง flow หลักตามสคริปต์ด้านล่าง (เผื่อเน็ตล่ม)
- [ ] เตรียมฮอตสปอตมือถือสำรอง (ทดสอบว่าโน้ตบุ๊กต่อแล้วเปิดเว็บได้)
- [ ] รู้วิธี **ปิดการยืนยันอีเมล** ถ้า SMTP มีปัญหาในวันจริง (spec §8.6 แผนสำรอง ไม่ต้องแก้โค้ด):
      Authentication > Sign In / Providers > Email > ปิด "Confirm email" (ชื่อเมนูอาจเปลี่ยนตามเวอร์ชัน Dashboard)
      เมื่อปิด ผู้สมัครเข้าสู่ระบบได้ทันที (เว็บพาไป `/dashboard` เอง) หลังสาธิตเปิดกลับ
- [ ] แผนสำรองสุดท้าย: รันบนโน้ตบุ๊กแบบ local (`npx supabase start`, `npm run dev`, แล้ว
      `CONFIRM_PROJECT_REF=local DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres DEMO_PASSWORD=<...> npm run demo:reset`)
      เปิด http://localhost:3000 บนโน้ตบุ๊กเท่านั้น (มือถือผู้ชมเข้า localhost ไม่ได้)

## สคริปต์นำเสนอ 8-10 นาที

เตรียมก่อนขึ้นเวที: โน้ตบุ๊ก (ต่อโปรเจกเตอร์) ล็อกอิน `demo-teacher` ในหน้าต่างหนึ่ง, มือถือผู้นำเสนอล็อกอิน `demo-student`,
หน้าต่าง private อีกหน้าต่างไว้โชว์หน้าแรกแบบไม่ล็อกอิน, QR สมัครสมาชิกพร้อมบนสไลด์

| เวลา | ใคร / บัญชี | ทำอะไร |
|---|---|---|
| 0:00-1:00 | ไม่ล็อกอิน แล้ว `demo-student` | หน้าแรกยอดรวม carbon/ขยะ/ต้นไม้ → `/dashboard` ของนักเรียนที่มีข้อมูลย้อนหลัง 3 เดือน |
| 1:00-2:30 | `demo-teacher` | สร้างกิจกรรมสดที่ `/staff/activities/new` (ชนิด "ชั่งน้ำหนักขยะ" ต้องใช้รหัส สถานะเปิด) |
| 2:30-4:00 | ผู้ชม + `demo-student` | ผู้ชมสแกน QR สมัคร (`/register`) ยืนยันอีเมล แล้วเข้าร่วมกิจกรรม; `demo-student` เข้าร่วมกิจกรรมเดียวกันบนมือถือ |
| 4:00-5:00 | `demo-teacher` | `/staff/weigh-station` เลือกกิจกรรม กด "ออกรหัสให้" `demo-student` (และผู้ชม 1 คน) ได้รหัส 6 หลัก |
| 5:00-6:00 | `demo-student` | ส่งผล: น้ำหนัก (กก./ขีด) + ถ่ายรูป + รหัส → "รอตรวจ" |
| 6:00-7:00 | `demo-teacher` | `/staff/reviews` เปิดผลแล้วกด "อนุมัติ" → โชว์มือถือ กระดิ่งแจ้งเตือนของนักเรียนเด้งทันที (มีผลรอตรวจตัวอย่างและผลไม่ผ่านพร้อมเหตุผลให้ดูด้วย) |
| 7:00-8:30 | `demo-student` แล้ว `demo-teacher` | `/rewards` ใส่ตะกร้า → `/cart` "ยืนยันแลก" → ดาวน์โหลดใบเสร็จ PDF; ครูที่ `/staff/orders` กด "เตรียมของเสร็จแล้ว" → "ยืนยันรับแล้ว" นักเรียนเห็น "รับแล้ว" |
| 8:30-10:00 | `demo-student` แล้ว `demo-teacher` | `/leaderboard` (เดือนนี้/ตลอดกาล) → `/staff/reports` ดูตัวอย่างและดาวน์โหลด PDF สรุป (ช่วง 3 เดือนที่ผ่านมามีข้อมูลตัวอย่าง) |

- ระหว่างสาธิตไม่แก้ค่าใน `/staff/rates` และไม่ใช้ `demo-admin` เปลี่ยนบทบาทผู้ใช้จริง
- ถ้าอีเมลยืนยันไม่มา: ใช้แผนสำรองปิดการยืนยันอีเมล (หัวข้อก่อนวันสาธิต) หรือให้ผู้ชมดูบนมือถือผู้นำเสนอ

## หลังวันสาธิต (ทำทันที)

- [ ] **เปลี่ยนรหัสผ่านบัญชีสาธิตทันที** (spec §8.3): รัน `demo:purge -- --yes` (ถ้าข้อมูลผู้ชมไม่ต้องเก็บ) แล้ว `demo:reset` ด้วย
      `DEMO_PASSWORD` ค่าใหม่ ถ้าต้องเก็บข้อมูลผู้ชมไว้ (reset จะไม่ยอมรัน) ให้ลบบัญชีสาธิตทั้ง 3 ที่ Authentication > Users แทน
- [ ] รัน `demo:purge` (และ `--yes`) ถ้าไม่ต้องการเก็บข้อมูลผู้ใช้ที่สมัครวันสาธิต
- [ ] ถ้าปิดการยืนยันอีเมลไว้ ให้เปิดกลับ
- [ ] ถ้าเผลอแสดงหรือแชร์ `CRON_SECRET` ให้สร้างค่าใหม่ ตั้งใน Vercel (Settings > Environment Variables) แล้ว redeploy
- [ ] ตรวจ `/staff/rates` และ `/staff/users` อีกครั้งว่าไม่มีอะไรถูกแก้ระหว่างสาธิต

## ทดลองกับเพื่อนในห้อง (5-10 คน บนมือถือจริง) ก่อนล็อกฟีเจอร์ราว 15 ก.พ.

ทำโดยเจ้าของโปรเจกต์ (plan Task 20 Step 5): ให้เพื่อน 5-10 คนใช้มือถือของตัวเองทำตามสคริปต์ด้านบนในบทบาทผู้ชม
(สมัคร → เข้าร่วม → ส่งผล → แลกของ) บันทึกบั๊กทุกข้อในตารางด้านล่าง แก้ก่อนล็อกฟีเจอร์ แล้วรัน `demo:purge` / `demo:reset` หลังทดลอง

| # | วันที่ | ผู้ทดสอบ | อุปกรณ์ / เบราว์เซอร์ | หน้า / ขั้นตอน | สิ่งที่เกิด | สิ่งที่ควรเป็น | ความรุนแรง (สูง/กลาง/ต่ำ) | สถานะ / commit ที่แก้ |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
