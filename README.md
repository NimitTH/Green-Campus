# Green Campus

เว็บแอปกิจกรรมอนุรักษ์สิ่งแวดล้อมและแลกแต้มรักโลกสำหรับวิทยาลัย: นักเรียนเข้าร่วมกิจกรรม (ชั่งขยะรีไซเคิล, ปลูกต้นไม้, กิจกรรมแต้มคงที่)
ส่งผลพร้อมรูปหลักฐาน ครูตรวจผล แต้มและ carbon ที่ลดได้คิดจากอัตราจริง แล้วนักเรียนนำแต้มไปแลกของรางวัล
มีอันดับรายเดือน รายงาน CSV/PDF และแจ้งเตือนแบบ realtime

A waste-management and reward-points web app for a Thai college: students join activities, submit results with photo evidence,
teachers review them, points and CO2e come from real rates, and students redeem points for rewards. Thai UI, mobile first.

Stack: Next.js 16 (App Router, Cache Components) · Supabase (Postgres + RLS, Auth, Storage, Realtime, pg_cron) · Tailwind CSS 4 ·
pdfmake (Thai PDFs, Sarabun) · Vitest · Playwright · pgTAP. Deploy: Vercel + Supabase Cloud (Singapore).

## เริ่มต้นบนเครื่อง / Local quickstart

ต้องมี Node 24, Docker Desktop (สำหรับ Supabase บนเครื่อง)

```bash
npm install
cp .env.example .env.local        # fill in the values printed by `npx supabase status`
npx supabase start                # local Postgres, Auth, Storage, Mailpit (http://127.0.0.1:54324)
npx supabase db reset             # apply supabase/migrations
npm run dev                       # http://localhost:3000 (always localhost, not 127.0.0.1)
```

ข้อมูลตัวอย่างสำหรับสาธิต (local):

```bash
CONFIRM_PROJECT_REF=local DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres DEMO_PASSWORD='<at least 12 chars>' npm run demo:reset
```

## ทดสอบ / Tests

| คำสั่ง | ทดสอบอะไร |
|---|---|
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npx supabase test db` | pgTAP: schema, RLS, database functions (`supabase/tests`) |
| `npm run test:e2e` | Playwright e2e, desktop + mobile Chrome, against `npm run dev` and the local Supabase |
| `npm run test:e2e:prod` | e2e smoke subset against a production build (`next build && next start`, port 3100) |
| `npm run test:seed` | demo scripts (**purges local users**, local only) |
| `npm run lint` · `npx tsc -p scripts/tsconfig.json` · `npm run build` | lint, demo-script types, production build |

## เอกสาร / Docs

- [docs/deploy.md](docs/deploy.md): ขึ้นระบบจริง (Supabase Cloud + Vercel, region สิงคโปร์, Auth, cron, smoke test)
- [docs/dev-notes.md](docs/dev-notes.md): บันทึกการพัฒนาบนเครื่อง, e2e, cron, สคริปต์สาธิต
- [docs/demo-checklist.md](docs/demo-checklist.md): เช็กลิสต์และสคริปต์วันสาธิต
- [docs/smtp-setup.md](docs/smtp-setup.md): ตั้งค่าอีเมล (custom SMTP)
- [docs/carbon-sources.md](docs/carbon-sources.md): ที่มาของค่า carbon
- [docs/superpowers/specs/2026-10-14-waste-management-app-design.md](docs/superpowers/specs/2026-10-14-waste-management-app-design.md): design spec
