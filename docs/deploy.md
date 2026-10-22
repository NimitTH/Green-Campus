# คู่มือ deploy Green Campus (Supabase Cloud + Vercel)

เอกสารนี้ใช้ตอนขึ้นระบบจริงครั้งแรกและตอนตั้งโปรเจกต์ใหม่ ค่าทุกค่าในเอกสารนี้เป็นตัวอย่าง (`<...>`)
ห้ามจดรหัสผ่าน, secret key, connection string หรือ `CRON_SECRET` จริงลงไฟล์ที่เข้า git

ลำดับ: เลือก region → Supabase (โปรเจกต์ + migration + ตรวจ) → admin คนแรก → Auth → Vercel → smoke test หลัง deploy

## 1. เลือก region: สิงคโปร์ทั้งคู่

- `vercel.json` ตั้ง `"regions": ["sin1"]` (Vercel Functions รันที่สิงคโปร์)
- **โปรเจกต์ Supabase ต้องอยู่ที่ Southeast Asia (Singapore) `ap-southeast-1` ด้วย** ทุกหน้าที่ล็อกอินอ่านฐานข้อมูลหลายรอบต่อคำขอ
  ถ้าฐานข้อมูลกับฟังก์ชันอยู่คนละทวีป ทุกรอบจะช้าเพิ่มหลายร้อยมิลลิวินาที
- region ของโปรเจกต์ Supabase เปลี่ยนภายหลังไม่ได้ ถ้าจำเป็นต้องใช้ region อื่น ให้เปลี่ยน `regions` ใน `vercel.json` ให้ตรงกันในคราวเดียวกัน
  (ดูรหัส region ของ Vercel ที่ใกล้ region ของ Supabase ที่สุด)

## 2. Supabase

### 2.1 สร้างโปรเจกต์และใส่ migration

1. Supabase Dashboard > New project: เลือก region **Southeast Asia (Singapore)** ตั้งรหัสผ่านฐานข้อมูล (เก็บใน password manager)
2. บนเครื่อง (ในโฟลเดอร์โปรเจกต์) ผูก CLI กับโปรเจกต์ แล้วดูก่อนว่าจะใส่ migration อะไรบ้าง:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run   # แสดงรายการ migration ที่จะใส่ (0001 ... ล่าสุด) ยังไม่แก้อะไร
npx supabase db push             # ใส่จริง
```

- `db push` ใส่ไฟล์ใน `supabase/migrations` ตามลำดับเลข ถ้ามี migration ใหม่ภายหลังให้รัน 2 บรรทัดสุดท้ายซ้ำ
- ห้ามแก้ migration ที่ push ไปแล้ว ให้เพิ่มไฟล์เลขถัดไปแทน

### 2.2 ตรวจหลัง push (SQL Editor)

รันใน Dashboard > SQL Editor ทุกคำสั่งต้องได้ผลตามที่เขียนไว้:

```sql
-- 1) งานยกเลิกออเดอร์หมดอายุ (pg_cron, 0014) ต้องมี 1 แถว schedule '0 * * * *'
select jobname, schedule, active from cron.job where jobname = 'expire-orders';

-- 2) กระดิ่งแจ้งเตือนแบบ realtime (0009): ต้องมี 1 แถว
select * from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications';

-- 3) งานล้างรูปค้าง (0024) ใช้คอลัมน์ 2 ตัวนี้ของ storage.objects: ต้องได้ 2 แถว
select column_name from information_schema.columns
where table_schema = 'storage' and table_name = 'objects' and column_name in ('archived_at', 'is_delete_marker');
```

- ข้อ 1 ไม่มีแถว: เปิด extension `pg_cron` (Database > Extensions) แล้ว push ใหม่ หรือรันคำสั่ง `cron.schedule` ท้ายไฟล์ 0014 เอง
- ข้อ 3 ได้ไม่ครบ 2 แถว: อย่าเปิด cron ล้างรูป (ฟังก์ชันจะ error ตอนเรียก ไม่ลบอะไร) แจ้งผู้พัฒนาก่อน

### 2.3 admin คนแรก

1. สมัครบัญชีของตัวเองผ่านเว็บ (`/register`) และยืนยันอีเมลให้เรียบร้อย
2. ใน SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = '<your-email>');
```

ทำไมคำสั่งนี้ได้ผล: trigger ที่กันการเปลี่ยนบทบาท (`protect_profile_columns`) อนุญาตเฉพาะเมื่อไม่มีผู้ใช้ปลายทาง
ใน SQL Editor คำสั่งรันเป็น `postgres` ไม่มี JWT ของผู้ใช้ `auth.uid()` จึงเป็น `null` เหมือนงานของระบบ ผู้ใช้ทั่วไปทำแบบนี้ผ่านเว็บไม่ได้
หลังจากนี้ admin คนนี้ตั้งบทบาทครูให้คนอื่นที่ `/staff/users` ได้เอง

### 2.4 Authentication

- **URL Configuration**
  - Site URL: `https://<โดเมน>`
  - Redirect URLs: `https://<โดเมน>/auth/callback` และ `https://<โดเมน>/auth/callback/reset`
    (สมัคร → `/auth/callback` แล้วไป `/dashboard`; ลืมรหัสผ่าน → `/auth/callback/reset` แล้วไป `/reset-password`)
    ถ้าใช้ Preview deployment ด้วย ให้เพิ่ม `https://<preview-โดเมน>/**`
- **Custom SMTP**: ต้องตั้งก่อนให้นักเรียนสมัครจริง ทำตาม `docs/smtp-setup.md`
- **Rate Limits** (Authentication > Rate Limits)
  - อีเมลต่อชั่วโมง: ตั้งให้พอกับจำนวนผู้ชมที่จะสมัครพร้อมกัน x 2 (สมัคร + ลืมรหัส) ใช้ได้เมื่อมี custom SMTP แล้ว
  - **sign-up / sign-in และ token refresh ต่อ IP: ต้องเพิ่ม** (I4) คำขอ Auth ทุกคำขอของเว็บนี้ออกจากเซิร์ฟเวอร์ Vercel
    (Server Action และ proxy) Supabase จึงเห็นผู้ใช้ทุกคนมาจาก IP ของ Vercel ไม่กี่ตัว ค่าเริ่มต้นต่อ IP จะทำให้ผู้ชมทั้งห้องที่สมัครพร้อมกัน
    โดนปฏิเสธ ตั้งให้รองรับจำนวนผู้ชม (เช่น ผู้ชม 60 คน = อย่างน้อย 60+ ครั้งต่อช่วงเวลา) แล้วลดกลับหลังสาธิต
- **Confirm email** (Sign In / Providers > Email): เปิดไว้ตามปกติ แผนสำรองถ้า SMTP มีปัญหาวันจริงอยู่ใน `docs/demo-checklist.md`
- **ข้อจำกัด PKCE ในเบราว์เซอร์ในแอป**: ลิงก์ในอีเมลใช้ได้เฉพาะในเบราว์เซอร์เดียวกับที่กดสมัคร/ขอลิงก์ ถ้าสแกน QR แล้วสมัครในเบราว์เซอร์ในแอป
  (LINE, Facebook, Instagram) แต่กดลิงก์ในแอปอีเมลซึ่งเปิด Chrome/Safari จะขึ้นว่าลิงก์หมดอายุ บอกผู้ชมให้เปิด QR ด้วย Chrome/Safari
  ตั้งแต่แรก หรือกดเข้าสู่ระบบใหม่หลังยืนยัน

## 3. Vercel

1. Vercel > Add New > Project > Import Git Repository เลือก repo นี้ (Framework: Next.js, ไม่ต้องแก้ build command)
2. **ตั้งตัวแปรเองที่ Settings > Environment Variables** ทั้ง **Production** และ **Preview** ชื่อตาม `.env.example`:

| ชื่อ | ค่า | หมายเหตุ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | build-time |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (Project Settings > API Keys) | build-time |
| `NEXT_PUBLIC_SITE_URL` | `https://<โดเมน>` (Preview: URL ของ preview) | build-time, ใช้ในลิงก์อีเมล |
| `SUPABASE_SECRET_KEY` | secret key | server only ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_` |
| `CRON_SECRET` | ค่าสุ่ม `openssl rand -hex 32` | server only |

- ตัวแปร `NEXT_PUBLIC_*` ถูกฝังตอน build: แก้ค่าแล้วต้อง **Redeploy** ค่าใหม่จึงมีผล
- อย่าพึ่ง Supabase integration ของ Vercel: integration ตั้งตัวแปรชื่ออื่น (เช่น `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  ที่โค้ดนี้ไม่อ่าน ตั้งชื่อข้างบนเองให้ครบ
- `DATABASE_URL`, `DEMO_PASSWORD`, `CONFIRM_PROJECT_REF` ไม่ต้องตั้งใน Vercel (ใช้เฉพาะสคริปต์สาธิตบนเครื่องผู้ดูแล)

3. Deploy แล้วตรวจ **Settings > Cron Jobs** ว่ามี `/api/cron/cleanup-orphans` (`0 19 * * *` UTC = 02:00 เวลาไทย)
4. เรียกครั้งแรกแบบไม่ลบ:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://<โดเมน>/api/cron/cleanup-orphans?dry=1"
```

ต้องได้ JSON `{deleted, byBucket, scanned, dryRun: true, capped}` (ได้ 500 `cron_not_configured` = ยังไม่ได้ตั้ง `CRON_SECRET`)

## 4. smoke test หลัง deploy

- [ ] หน้าแรก `/` แสดงยอดรวมจริง (carbon / ขยะ / ต้นไม้) ไม่ใช่ 0 ทั้งหมดหลังรัน `demo:reset`
- [ ] สมัครด้วยอีเมลภายนอก ได้อีเมล กดลิงก์แล้วกลับมาที่ `https://<โดเมน>/dashboard`
- [ ] ดาวน์โหลด **ใบเสร็จ PDF** (`/orders/<id>`) และ **PDF สรุป** (`/staff/reports`) ภาษาไทยแสดงถูก (ฟอนต์ Sarabun ไม่เป็นกล่อง)
- [ ] กระดิ่งอัปเดตทันทีข้าม 2 เครื่อง: เครื่อง A นักเรียนเปิดหน้าใดก็ได้, เครื่อง B ครูอนุมัติผล → ตัวเลขบนกระดิ่งของ A เปลี่ยนเองโดยไม่รีเฟรช
- [ ] `demo:reset` ผ่าน **Session pooler** ใช้ได้ (ดูคำสั่งใน `docs/demo-checklist.md`)
- [ ] `/api/cron/cleanup-orphans?dry=1` ตอบ 200 (ข้อ 3.4)

## 5. ทดสอบโหมด production บนเครื่อง

ก่อน deploy ลองรันเว็บแบบ production (`next build` + `next start`) กับ Supabase บนเครื่อง:

```bash
npx supabase start
npm run test:e2e:prod     # build + start ที่พอร์ต 3100 แล้วรัน smoke subset (full-flow, articles, leaderboard, preserved-forms)
```

- โหมดนี้จับบั๊กที่เกิดเฉพาะ production ได้ เช่น บทความที่ไม่มี/ยกเลิกเผยแพร่เคยตอบ 200 แทน 404 บน `next start`
  (หน้าแบบ partial prerender ส่ง shell ก่อน) ตอนนี้ `src/proxy.ts` ตรวจ slug แล้วส่งไปหน้า 404 แบบ static
- รันซ้ำทุกครั้งก่อน deploy เวอร์ชันใหม่
