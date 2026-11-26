# เปิด "เข้าสู่ระบบด้วย Google"

คู่มือนี้พาตั้งค่าทีละขั้นตอน ตั้งแต่สร้าง OAuth Client ใน Google ไปจนเปิดปุ่มบนเว็บจริง ส่วนที่เป็นโค้ดทำไว้ครบแล้ว
(ดูแบบที่ `docs/superpowers/specs/2026-11-26-google-signin-design.md`)

> **ห้ามเอา Client Secret ไปวางในแชต ใน Git หรือในภาพหน้าจอ** ถ้าเผลอแชร์ ให้สร้าง Secret ใหม่ใน Google Cloud
> แล้วนำไปใส่แทนใน Supabase

## มันทำงานอย่างไร

```
ผู้ใช้กดปุ่ม Google ─▶ หน้าเลือกบัญชีของ Google
                   ─▶ https://<project-ref>.supabase.co/auth/v1/callback   (Supabase รับคำตอบจาก Google)
                   ─▶ https://<โดเมน>/auth/callback/google                 (เว็บเราสร้าง session แล้วพาไปหน้าที่ต้องการ)
```

- **คนใหม่:** ได้บัญชีนักเรียนอัตโนมัติ ชื่อมาจากบัญชี Google แก้ทีหลังได้ที่หน้าโปรไฟล์
- **คนที่เคยสมัครด้วยอีเมลเดียวกัน:** Supabase รวมเป็นบัญชีเดียวกัน แต้มและประวัติยังอยู่ครบ
- **บัญชีที่ถูกระงับ:** ถูกออกจากระบบทันที เหมือนการเข้าสู่ระบบด้วยรหัสผ่าน
- **ผู้ใช้กดยกเลิกที่หน้า Google:** กลับมาหน้าเข้าสู่ระบบพร้อมข้อความ "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้ง"
- **ปุ่มทำงานเมื่อ `NEXT_PUBLIC_GOOGLE_AUTH=on` เท่านั้น:** ถ้าไม่ได้ตั้ง ปุ่มจะขึ้น "ยังไม่เปิดให้ใช้งาน" เหมือนเดิม

## ขั้นที่ 1: Google Cloud Console

ต้องมี `<project-ref>` ของ Supabase ก่อน ดูได้จาก URL ของโปรเจกต์ เช่น `https://abcdefgh.supabase.co` → `abcdefgh`

1. เปิด https://console.cloud.google.com แล้วล็อกอินด้วยบัญชี Google ของคุณ
2. แถบบนสุด กดเลือกโปรเจกต์ › **New Project** › ตั้งชื่อ เช่น `Green Campus` › **Create** แล้วเลือกโปรเจกต์นี้
3. เมนูซ้าย **APIs & Services › OAuth consent screen** (บางรุ่นชื่อ **Google Auth Platform › Branding**)
   - **User type: External**
   - **App name:** `Green Campus`
   - **User support email** และ **Developer contact:** อีเมลของคุณ
   - Scopes ไม่ต้องเพิ่ม (ใช้ค่าเริ่มต้น `email`, `profile`, `openid`)
   - บันทึก แล้วไปที่ **Audience** (หรือ **Publishing status**) กด **Publish app** ให้เป็น *In production*
     ถ้ายังเป็น *Testing* จะมีแค่บัญชีที่เพิ่มเป็น Test users เท่านั้นที่ล็อกอินได้
4. **APIs & Services › Credentials › Create credentials › OAuth client ID**
   - **Application type:** Web application
   - **Name:** `Green Campus web`
   - **Authorized JavaScript origins:** `https://<โดเมน Vercel ของคุณ>`
   - **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback`
     (ต้องเป็นที่อยู่ของ Supabase ไม่ใช่ของเว็บเรา)
   - กด **Create** จะได้ **Client ID** กับ **Client Secret** เปิดหน้าต่างนี้ค้างไว้สำหรับขั้นที่ 2

## ขั้นที่ 2: Supabase Dashboard (โปรเจกต์บน Cloud)

1. **Authentication › Sign In / Providers › Google**
   - เปิด **Enable Sign in with Google**
   - วาง **Client ID** และ **Client Secret** จากขั้นที่ 1
   - เช็กว่า **Callback URL** ที่ Supabase แสดง ตรงกับ redirect URI ที่ใส่ใน Google ทุกตัวอักษร
   - **Save**
2. **Authentication › URL Configuration › Redirect URLs** › **Add URL**
   - `https://<โดเมนของคุณ>/auth/callback/google`
   - ถ้าใช้ Preview deployment ด้วย: มี `https://<preview-โดเมน>/**` ตาม `docs/deploy.md` ข้อ 2.3 อยู่แล้ว ใช้ได้เลย

## ขั้นที่ 3: Vercel

1. **Settings › Environment Variables** เพิ่ม `NEXT_PUBLIC_GOOGLE_AUTH` = `on` (Production และ Preview)
2. **Deployments ›** อันล่าสุด **› Redeploy**
   - ตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_` ถูกฝังตอน build ต้อง redeploy ปุ่มจึงจะเปลี่ยน

## ขั้นที่ 4: ทดสอบบนเว็บจริง

1. ใช้หน้าต่างไม่ระบุตัวตน เปิด `/login` › กด **เข้าสู่ระบบด้วย Google** › เลือกบัญชีที่ยังไม่เคยสมัคร
   ต้องเข้าหน้า dashboard นักเรียน และเห็นชื่อจาก Google
2. ออกจากระบบ › ล็อกอินด้วย Google อีกครั้ง ต้องได้บัญชีเดิม
3. ลองกับอีเมลที่เคยสมัครด้วยรหัสผ่านแล้ว แต้มและประวัติต้องอยู่ครบ
4. กด Google แล้วกด **ยกเลิก** หรือปิดหน้าเลือกบัญชี ต้องกลับมาหน้าเข้าสู่ระบบพร้อมข้อความ Google
5. เปิด `/login?next=/rewards` แล้วล็อกอินด้วย Google ต้องไปจบที่หน้าของรางวัล

**ปัญหาที่พบบ่อย**
- **`redirect_uri_mismatch` ที่หน้า Google:** redirect URI ในขั้นที่ 1 ไม่ตรงกับ Callback URL ของ Supabase
- **กลับมาหน้าเข้าสู่ระบบพร้อมข้อความ Google ทุกครั้ง:** ยังไม่ได้เพิ่ม `/auth/callback/google` ใน Redirect URLs (ขั้นที่ 2.2)
  หรือเปิดเว็บกับ callback คนละโดเมน
- **กดปุ่มแล้วขึ้น "ยังไม่เปิดให้ใช้งาน":** ยังไม่ได้ตั้ง `NEXT_PUBLIC_GOOGLE_AUTH=on` หรือยังไม่ได้ redeploy
- **ล็อกอินได้เฉพาะบางบัญชี:** OAuth consent screen ยังอยู่ในสถานะ *Testing* (ขั้นที่ 1.3)

## (ไม่บังคับ) ลองบนเครื่องตัวเอง

1. ใน OAuth client เดิม เพิ่ม redirect URI `http://127.0.0.1:54321/auth/v1/callback`
   และเพิ่ม JavaScript origin `http://localhost:3000`
2. ตั้งตัวแปรใน PowerShell ก่อนสั่ง start (ห้ามเขียนลงไฟล์ที่เข้า Git):
   ```powershell
   $env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID = "<client id>"
   $env:SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET = "<client secret>"
   ```
3. ใน `supabase/config.toml` หัวข้อ `[auth.external.google]` แก้เป็น `enabled = true` ชั่วคราว (ห้าม commit)
4. `npx supabase stop` แล้ว `npx supabase start` (ใน PowerShell หน้าต่างเดียวกับที่ตั้งตัวแปร)
5. ใส่ `NEXT_PUBLIC_GOOGLE_AUTH=on` ใน `.env.local` แล้วเปิด `npm run dev` ใหม่
6. เสร็จแล้วเปลี่ยน `enabled` กลับเป็น `false`

เทสต์อัตโนมัติ (`tests/e2e/google-signin.spec.ts`) ไม่ได้ติดต่อ Google จริง มันดักคำขอไปที่ Supabase ไว้ก่อน
การล็อกอินกับ Google จริงจึงต้องทดสอบด้วยมือตามขั้นที่ 4
