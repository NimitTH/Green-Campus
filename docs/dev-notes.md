# บันทึกการพัฒนาบนเครื่อง (local)

- เปิดเว็บที่ **http://localhost:3000** เสมอ ไม่ใช้ http://127.0.0.1:3000
  คุกกี้เข้าสู่ระบบผูกกับชื่อโฮสต์ และลิงก์ในอีเมลชี้ไปที่ `NEXT_PUBLIC_SITE_URL`
  (ค่าใน `.env.local` ควรเป็น `http://localhost:3000`) ถ้าสมัครจาก 127.0.0.1 แล้วกดลิงก์ที่ไป localhost
  จะเข้าสู่ระบบไม่ได้
- แก้ `supabase/config.toml` แล้วต้องรัน `npx supabase stop` แล้ว `npx supabase start` ค่าใหม่จึงมีผล
  (`npx supabase db reset` อย่างเดียวไม่อ่าน config ใหม่ของ Auth)
- ลิงก์ในอีเมล (ยืนยันการสมัคร, ตั้งรหัสผ่านใหม่) ใช้ได้เฉพาะในเบราว์เซอร์เดียวกับที่กดสมัคร/ขอลิงก์ (PKCE)
  เปิดในเบราว์เซอร์อื่นจะเห็นข้อความว่าลิงก์หมดอายุ
- อีเมลทั้งหมดบนเครื่องอยู่ใน Mailpit http://127.0.0.1:54324 (รวมเป็นรายการเดียว ไม่มีโฟลเดอร์ Spam)
- ลิงก์ในอีเมลกลับมาที่ `/auth/callback` (สมัคร → `/dashboard`) หรือ `/auth/callback/reset`
  (ลืมรหัส → `/reset-password`) ถ้า Supabase ส่งกลับมาที่หน้าแรก `/?code=...` (เช่น config เก่ายังไม่ restart)
  proxy จะส่งต่อไป `/auth/callback` ให้เอง
- ถ้า log ของ `npm run dev` เตือนเรื่อง cross-origin request (HMR) จาก 127.0.0.1 ให้เปิดผ่าน localhost แทน
  หรือเพิ่ม `allowedDevOrigins: ['127.0.0.1']` ใน `next.config.ts`
  (ดู node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/allowedDevOrigins.md)

## ทดสอบ end-to-end (Playwright)

- ติดตั้งครั้งแรก: `npm install` (ได้ `@playwright/test`) แล้ว `npx playwright install chromium`
  (ดาวน์โหลดเบราว์เซอร์ครั้งเดียวต่อเครื่อง)
- ก่อนรัน: เปิด Supabase บนเครื่อง `npx supabase start` (และ `npx supabase db reset` ถ้ามี migration ใหม่)
  e2e ใช้ **Supabase บนเครื่องเท่านั้น**: helper อ่าน `NEXT_PUBLIC_SUPABASE_URL` และ `SUPABASE_SECRET_KEY`
  จาก `.env.local` เพื่อสร้างผู้ใช้ทดสอบที่ยืนยันอีเมลแล้วและตั้งบทบาท (ครู) แล้วลบทิ้งเมื่อจบ
  ถ้า URL ไม่ใช่ localhost/127.0.0.1 helper จะไม่ยอมทำงาน (กันสร้างผู้ใช้บน Cloud โดยไม่ตั้งใจ)
  helper ไม่พิมพ์ค่า key ออกมา
- รัน: `npm run test:e2e` (Playwright เปิด `npm run dev` ให้เอง หรือใช้ตัวที่เปิดอยู่แล้วที่ http://localhost:3000)
  มีสองโปรเจกต์: `chromium` (จอคอม) และ `mobile-chrome` (Pixel 7) ทั้งคู่ใช้ Chromium ตัวเดียวกัน
  รันเฉพาะหนึ่งโปรเจกต์: `npm run test:e2e -- --project=chromium`
- ดูรายงานเมื่อมีเทสต์ล้ม: `npx playwright show-report` (trace เก็บไว้เฉพาะเทสต์ที่ล้ม)
- เทสต์อยู่ที่ `tests/e2e/*.spec.ts`; Vitest อ่านเฉพาะ `src/**/*.test.ts` จึงไม่ชนกัน
  ไฟล์ e2e ถูกยกเว้นจาก `tsconfig.json` เพื่อให้ `npm run build` ไม่ขึ้นกับ Playwright

## Deploy: Cron / CRON_SECRET (ล้างรูปค้าง, Task 19)

- `vercel.json` ตั้ง Vercel Cron เรียก `GET /api/cron/cleanup-orphans` วันละครั้ง (`0 19 * * *` UTC = 02:00 เวลาไทย)
  ลบรูปใน bucket `evidence`, `reward-images`, `article-images` ที่ไม่มีแถวใดอ้างถึงและเก่ากว่า 24 ชั่วโมง ผ่าน Storage API
- ต้องตั้งตัวแปร `CRON_SECRET` ใน Vercel (Project Settings > Environment Variables) Vercel จะส่ง
  `Authorization: Bearer <CRON_SECRET>` ให้ cron เอง สร้างค่าด้วย `openssl rand -hex 32` หรือ
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` ห้ามเก็บค่าจริงลง git
  ถ้าไม่ตั้ง route จะตอบ 500 `cron_not_configured` และไม่ลบอะไร
- แพ็กเกจ Hobby: cron รันได้วันละครั้งเท่านั้น และเวลาจริงอาจคลาดภายในชั่วโมงที่ตั้งไว้ (ปัจจุบันใช้วันละครั้ง เหมาะกับ Hobby)
- หลัง deploy ลองเรียกแบบไม่ลบก่อน: `curl -H "Authorization: Bearer $CRON_SECRET" "https://<โดเมน>/api/cron/cleanup-orphans?dry=1"`
  จะได้ `{deleted, byBucket, scanned, dryRun, capped}` (`deleted` ในโหมด dry = จำนวนที่จะลบ)
- รันครั้งละไม่เกิน 2000 ไฟล์ (`capped: true` = ยังเหลือ รอบถัดไปจะทำต่อ)
- e2e บนเครื่องใช้ค่าทดสอบ `e2e-cron-secret` ที่ `playwright.config.ts` ตั้งให้ dev server เอง (เฉพาะนอก CI) ถ้าเปิด
  `npm run dev` เองก่อนรันเทสต์ ให้เปิดด้วย `CRON_SECRET=e2e-cron-secret npm run dev`
- CI: ถ้ารัน e2e ใน CI (`CI=1`) `playwright.config.ts` จะไม่ใส่ค่า `CRON_SECRET` ให้ ต้องตั้ง `CRON_SECRET` เป็นตัวแปรของ job เอง
  (ค่าสุ่มสำหรับ CI เท่านั้น) ไม่เช่นนั้นเทสต์ `cleanup-orphans.spec.ts` จะได้ 500 `cron_not_configured`
  (spec นี้อ่าน `process.env.CRON_SECRET` ตัวเดียวกัน)
- การเลือกไฟล์ค้างทำใน SQL `public.storage_orphan_candidates` (migration 0023, อ่านอย่างเดียว, เฉพาะ service_role)
  ส่วนการลบยังทำผ่าน Storage API เท่านั้น และตรวจซ้ำกับตารางอ้างอิงก่อนลบทุกชุด 100 ไฟล์
- `export const maxDuration = 60` ในไฟล์ route: บน Hobby เพดานจริงเป็นของแพ็กเกจ อาจต่ำกว่านี้
