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
