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
