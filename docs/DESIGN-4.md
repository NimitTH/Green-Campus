# Green Campus: รอบปรับที่สี่ (ค้นหา/เรียง/กรอง/แบ่งหน้าทุกรายการ, ฝั่ง staff, ประเภทบทความ, จัดการบัญชีนักเรียน)

> สถานะ: spec รอเจ้าของตรวจ · branch `redesign-4` (แตกจาก `main` ที่ 9e147cd) · brainstorming 6 พ.ย. 2026
> ต่อยอดจาก `docs/DESIGN-3.md` และ `docs/DESIGN-2.md` ทุกอย่างที่ไม่ได้เขียนในไฟล์นี้ให้ยึดสองไฟล์นั้น
> คำขอเดิมและคำตอบของเจ้าของ: `docs/REDESIGN-4-REQUEST.md` (ไม่อยู่ใน git)
> mockup ที่เจ้าของผ่านแล้ว: `.superpowers/brainstorm/726-1793898979/content/` (gitignored) · `toolbar.html` แบบ **B** · `staff-shell.html` · `staff-chart.html` **A + B** · `cover-icons.html` แบบ **B**

---

## 1. ข้อห้ามและข้อยกเว้น

### 1.1 ยังห้ามเหมือนเดิม

- ห้าม stage/commit: `AGENTS.md`, `docs/carbon-sources.md`, `docs/HANDOFF.md`, `docs/REDESIGN-4-REQUEST.md`, `src/app/_components/home/hero.tsx` (เจ้าของแก้ค้างไว้), `.agents/`, `.claude/`, `skills-lock.json` · stage ทีละ path เท่านั้น ห้าม `commit -a` / `add -A` / `add .` · ตรวจ `git diff --cached --stat` ก่อน commit ทุกครั้ง
- ห้ามเพิ่ม dependency (recharts มีอยู่แล้ว), ห้าม `npm --force` / `--legacy-peer-deps`
- ห้ามแก้ migration และไฟล์ pgTAP ที่มีอยู่แล้ว
- ห้ามเปลี่ยนข้อความปุ่ม/ป้าย/เมนู/`data-testid`/aria เดิม นอกจากที่ระบุใน §1.3
- ทุกงานรัน gate เต็มตาม HANDOFF §9 ก่อน commit · ห้าม merge หรือ push จนกว่าเจ้าของสั่ง
- หน้า `/staff/**` คง chrome ของตัวเอง (header, sidebar, drawer) ไม่ใช้ `SiteHeader`/`SiteFooter`

### 1.2 ข้อยกเว้นที่เจ้าของอนุมัติ (6 พ.ย. 2026)

- migration ใหม่ `0032`–`0036` และไฟล์ pgTAP ใหม่ ตาม §7
- แก้ `src/lib/**`, `src/app/actions/**`, `src/app/auth/**` ได้เท่าที่งานใน spec นี้ต้องใช้ · เพิ่ม route handler `src/app/auth/signout/route.ts`
- `src/lib/supabase/admin.ts` (secret key) ใช้ได้เพิ่มใน `src/app/actions/accounts.ts` เท่านั้น
- เอาการ์ดเมนูใหญ่ในหน้า `/staff` ออก (ข้อความ hint ของการ์ดเหล่านั้นหายได้)
- ย้ายแผง "ปรับแต้ม" จาก `/staff/users/[id]` ไป `/staff/students/[id]` (§6.1)
- `src/proxy.ts`, `src/app/api/**`, `scripts/**` ยังห้ามแตะ

### 1.3 ข้อความที่เพิ่ม/เปลี่ยนได้

| ที่ | ข้อความ |
|---|---|
| แถบเครื่องมือรายการ | "เรียงตาม" (แทน "เรียง") · ชื่อหัวข้อเรียงตาม §2.3 · ปุ่มทิศทาง "มาก → น้อย"/"น้อย → มาก", "ใหม่ → เก่า"/"เก่า → ใหม่", "ก → ฮ"/"ฮ → ก", สถานะของ `/my-submissions` "รอตรวจก่อน"/"ปฏิเสธก่อน" · `aria-label` ของปุ่มทิศทาง "{ข้อความที่เห็น}, กดเพื่อเปลี่ยนเป็น {อีกทิศ}" · ป้ายตัวกรองและตัวเลือกตาม §3/§4 · "ทั้งหมด" · placeholder "ค้นหาการแจ้งเตือน", "ค้นหาสินค้าหรือเลขที่ออเดอร์", "ค้นหารางวัล", "ค้นหากิจกรรมที่เคยส่ง", "ค้นหาในตะกร้า", "ค้นหาบทความ", "ค้นหานักเรียน" · "ไม่พบรายการที่ตรงกับคำค้น" |
| แจ้งเตือน | "ลบ" (aria "ลบการแจ้งเตือน {ชื่อเรื่อง}") · "ลบที่อ่านแล้วทั้งหมด" · ยืนยัน "ลบการแจ้งเตือนที่อ่านแล้วทั้งหมด?" · "ระบบเก็บการแจ้งเตือนล่าสุด 100 รายการ" |
| ตะกร้า | "แต้มที่มี", "แต้มรวม", "เหลือ {N} แต้ม", "ขาดอีก {N} แต้ม" |
| ผลที่ส่ง | "ดูกิจกรรม" (aria ของภาพปก) |
| navbar ครู/admin | เมนูกลางและแถบล่างตาม §4.1 |
| sidebar staff | "ยุบเมนู", "กางเมนู", เมนูใหม่ "บัญชีนักเรียน" |
| `/staff` | คำทักทาย (เพิ่ม "สวัสดีตอนดึก"), ป้ายบทบาท "ครู"/"ผู้ดูแลระบบ" · หัวข้อกราฟ "carbon ที่ลดได้รายเดือน (กก. CO₂e)", "ขยะแยกตามกลุ่ม (กก.)" · "ยังไม่มีข้อมูล" |
| รายการ staff | ปุ่ม "ดู", "กลับ" · ป้าย "ใช้รหัสจุดชั่ง" · `/staff/orders` ว่าง "ยังไม่มีออเดอร์ที่รอรับ" (เจ้าของอนุมัติ 11 พ.ย. 2026) |
| บทความ | ป้าย "ประเภทบทความ" · "ให้ความรู้", "ประกาศ", "อื่นๆ" |
| วันที่ | placeholder "วว/ดด/ปปปป" · aria "เลือกวันที่จากปฏิทิน", "เดือนก่อน", "เดือนถัดไป" · "วันที่ไม่ถูกต้อง (วว/ดด/ปปปป พ.ศ.)" · ป้าย "เวลา" |
| skeleton | "กำลังโหลด..." (เดิม) |
| บัญชีนักเรียน | ข้อความทั้งหมดใน §6 |

`tests/redesign/check-scope.mjs`: ข้อความใหม่ลงไฟล์ allowlist ใหม่ `tests/redesign/ui-strings-4.allow.txt` · ข้อความที่หายตาม §1.2 (hint ของการ์ดเมนู `/staff`, "เรียง", ตัวเลือก "ใหม่ → เก่า"/"เก่า → ใหม่" ที่ย้ายไปเป็นปุ่มทิศทาง) ลง `ui-strings-4.removed.txt` · เปิด path ตาม §1.2 · ปรับ `use-cache-count` ตามจำนวนจริง พร้อมเหตุผลใน §10

---

## 2. ชุดรายการกลาง (`src/app/_components/list/`)

### 2.1 config ต่อหน้า

```ts
type ListConfig = {
  sorts: Record<string, { label: string; kind: "date" | "number" | "text"; defaultDir: "asc" | "desc" }>;
  defaultSort: string;                          // คีย์แรกที่แสดง
  filters?: Record<string, { label: string; options: Record<string, string> }>; // ค่า "all" มีเสมอ ไม่ต้องใส่
  views?: boolean;                              // มีสลับการ์ด/รายการหรือไม่
  pageSize?: number;                            // ค่าเริ่ม 12
};
```

- config แต่ละหน้าอยู่ไฟล์เดียวกับ query ของหน้านั้น (`src/lib/**/list-config.ts`) ใช้ทั้งฝั่ง server (สร้าง query) และ client (แถบเครื่องมือ)

### 2.2 URL

- `q` (≤ 100 ตัว, trim เหมือนเดิม) · `sort` (คีย์ใน config) · `dir` (`asc`|`desc`) · ชื่อตัวกรองตาม config · `view` (`card`|`list`) · `page` ≥ 1
- `parseListParams(config, searchParams)` คืนค่าที่ถูกต้องเสมอ ค่าผิดรูป/ไม่รู้จัก → ค่าเริ่มต้น · ไม่มี `dir` → `defaultDir` ของหัวข้อนั้น
- ใช้แทนกันได้กับรอบ 3: `sort=new` = `sort=date&dir=desc`, `sort=old` = `sort=date&dir=asc`
- `listHref(base, config, current, patch)` ไม่ใส่ค่าเริ่มต้นใน URL · เปลี่ยน `q`/`sort`/`dir`/ตัวกรอง → `page` กลับเป็น 1 · เปลี่ยน `view` คง `page`

### 2.3 แถบเครื่องมือ (แบบ B)

- แถวที่ 1: ช่องค้นหา (ยืดเต็ม) + สลับการ์ด/รายการ (ถ้ามี)
- แถวที่ 2 (มือถือขึ้นบรรทัดใหม่ตามพื้นที่): ป้าย "เรียงตาม" + select หัวข้อ + ปุ่มทิศทาง + ตัวกรองแต่ละตัว (ป้าย + select)
- ข้อความบนปุ่มทิศทางตาม `kind`: date → "ใหม่ → เก่า"/"เก่า → ใหม่" · number → "มาก → น้อย"/"น้อย → มาก" · text → "ก → ฮ"/"ฮ → ก" · ปุ่มเป็นลิงก์ (`aria-label` = "{ข้อความที่เห็น}, กดเพื่อเปลี่ยนเป็น {ข้อความของทิศทางที่จะเปลี่ยนไป}" เช่น "ใหม่ → เก่า, กดเพื่อเปลี่ยนเป็น เก่า → ใหม่" เพื่อให้ชื่อที่เข้าถึงได้ขึ้นต้นด้วยข้อความที่เห็น (WCAG 2.5.3) (เจ้าของตัดสิน 8 พ.ย. 2026, D1) · `SortSpec.dirLabels?: { asc, desc }` แทนข้อความตาม `kind` ได้)
- เปลี่ยน select แล้ว `router.replace` ทันที · ไม่มี JavaScript: form GET + ปุ่ม submit แบบ sr-only ที่แสดงเมื่อ focus (เหมือนรอบ 3)
- เป้ากด ≥ 44px · 360px ไม่มี horizontal scroll

### 2.4 การเรียงฝั่งฐานข้อมูล

- `.order(column, { ascending })` ตามด้วย `.order("id")` เสมอ · ค่า null ไว้ท้ายเสมอ (`nullsFirst: false`)
- ข้อความเรียงด้วย collation ของฐานข้อมูล (local `en_US.UTF-8` เรียงไทย ก-ฮ ถูก ตรวจแล้ว 6 พ.ย.) · Cloud ตรวจตาม §11
- ค้นหาด้วย `toIlikePattern`/`quoteOrValue` เดิม · หน้าเกินหน้าสุดท้าย → แสดงหน้าสุดท้าย (แบบรอบ 3)
- หน้าที่เรียงในแอป (`/cart`, จุดชั่ง): `Intl.Collator("th")` สำหรับข้อความ

### 2.5 ไฟล์

- `list-params.ts` (generic ตาม config) + test · `list-toolbar.tsx` (แบบ B) · `sort-direction.tsx` · `filter-select.tsx` · `pagination.tsx`, `view-toggle.tsx`, `search-escape.ts` เดิม
- `client-list.ts`: `sortRows`/`paginateRows` สำหรับหน้าที่เรียงในแอป + test
- `/articles` และ `/activities` ของรอบ 3 ย้ายมาใช้ config ใหม่

---

## 3. หน้าฝั่งนักเรียน (ช่วงส่งที่ 1)

หน้าละ 12 รายการ · หัวข้อเรียงแรก = ค่าเริ่มต้น · ทุกหน้าแสดงสถานะว่างเดิมเมื่อไม่มีข้อมูล และ "ไม่พบรายการที่ตรงกับคำค้น" + "ล้างการค้นหา" เมื่อค้นแล้วไม่พบ

| หน้า | ค้นหา | เรียงตาม (คีย์: ป้าย, ทิศเริ่ม) | กรอง | ที่มา |
|---|---|---|---|---|
| `/notifications` | `title` | `date`: วันที่ ↓ · `name`: ชื่อ ↑ | `type`: กิจกรรม (`activity_%`) / ผลที่ส่ง (`submission_%`) / ออเดอร์ (`order_%`) | ตาราง `notifications` (RLS เดิม) |
| `/orders` | ชื่อสินค้า (`item_names`), เลขที่ออเดอร์ (แบบที่ staff ใช้อยู่) | `date`: วันที่ ↓ | — | view `my_order_list` |
| `/rewards` | `name` | `date`: วันที่เพิ่ม ↓ · `price`: ราคา ↑ · `stock`: ชิ้นที่เหลือ ↓ · `name`: ชื่อ ↑ | — · มีสลับการ์ด/รายการ | ตาราง `rewards` (`active`) |
| `/my-submissions` | ชื่อกิจกรรม | `date`: วันที่ส่ง ↓ · `status`: สถานะ ↑ (รอตรวจ → อนุมัติ → ปฏิเสธ) ปุ่มทิศทางใช้ป้ายเฉพาะ "รอตรวจก่อน" (asc) / "ปฏิเสธก่อน" (desc) แทน "น้อย → มาก"/"มาก → น้อย" (`dirLabels`, D2) · `points`: แต้ม ↓ · `kg`: กก. ↓ · `name`: ชื่อกิจกรรม ↑ | — · มีสลับการ์ด/รายการ | view `my_submission_list` |
| `/cart` | ชื่อรางวัล | `date`: วันที่ใส่ ↓ · `price`: ราคา ↑ · `total`: แต้มรวม ↓ · `qty`: จำนวน ↓ · `name`: ชื่อ ↑ | — | `listCartLines` เดิม เรียง/แบ่งหน้าในแอป |
| `/activities` | (เดิม) | `date`: วันที่ ↓ · `name`: ชื่อ ↑ | `joined`: เข้าร่วมแล้ว / ยังไม่เข้าร่วม · `type`: ชั่งน้ำหนัก (`waste`) / ปลูกต้นไม้ (`trees`) / แต้มคงที่ (`fixed`) | `listActivitiesForStudentPage` เดิม + ตัวกรอง |
| `/articles` | (เดิม) | `date`: วันที่ ↓ · `name`: ชื่อ ↑ · `category`: ประเภท ↑ | `category`: ให้ความรู้ / ประกาศ / อื่นๆ | `listPublishedArticlesPage` เดิม (`'use cache'`) + คีย์ cache ใหม่ |

### 3.1 `/notifications` (และ `/staff/notifications` §4.4)

- component เดียว `NotificationsList` รับ config ตามบทบาท
- ปุ่ม "ลบ" ทุกแถว (`deleteNotification(id)`) · "ลบที่อ่านแล้วทั้งหมด" (`deleteReadNotifications()`) มี dialog ยืนยัน · ใช้ RLS ลบได้เฉพาะของตัวเอง (§7.1)
- หลังลบ: `refresh()` หน้า และกระดิ่งนับใหม่ (ส่ง event `notifications:changed` ใน window ที่กระดิ่งฟังอยู่ เพราะ Realtime เดิมฟังแค่ INSERT/UPDATE)
- นักเรียน: ข้อความเล็กใต้หัวข้อ "ระบบเก็บการแจ้งเตือนล่าสุด 100 รายการ" · trigger ลบรายการเก่าสุดเกิน 100 (§7.1)
- การแจ้งเตือนเดิม (`limit(50)`) เปลี่ยนเป็นแบ่งหน้า

### 3.2 `/my-submissions`

- การ์ด: ภาพปกกิจกรรม (ไม่มี → `CoverFallback` ตาม type) · ชื่อกิจกรรม · ป้ายสถานะเดิม · วันที่ส่ง · แต้ม/กก./ต้น · เหตุผลที่ถูกปฏิเสธ (เดิม)
- รายการ: ภาพย่อ 96×64 + ข้อความเดียวกัน
- ภาพปกเป็นลิงก์ไป `/activities/[id]` (`aria-label` "ดูกิจกรรม {ชื่อ}") · ข้อความอื่นไม่เป็นลิงก์ (ไม่ซ้อนลิงก์)
- `kg` ของกิจกรรมที่ไม่ใช่ waste เป็น null และอยู่ท้ายเสมอ

### 3.3 `/cart`

- แถบเครื่องมือ + แบ่งหน้าในแอป (ข้อมูลทั้งหมดของตะกร้ายังโหลดครั้งเดียว ยอดรวมคิดจากทุกบรรทัด ไม่ใช่เฉพาะหน้าที่เห็น)
- บรรทัดสรุปเหนือปุ่มสั่ง: "แต้มที่มี 1,200 − แต้มรวม 900 = เหลือ 300 แต้ม" · ถ้าไม่พอ "ขาดอีก N แต้ม" สี `warn` · `cartRemainder(balance, total)` + test
- `date` ใช้ `cart_items.created_at`

### 3.4 `/activities`, `/articles`

- เพิ่มตัวกรองตามตาราง · การ์ดไม่มีภาพปก → `CoverFallback` (§5.2) · `/articles` แสดงป้ายประเภท (§5.1)
- `joined` ใช้รายการ id ที่เข้าร่วมแล้วซึ่งโหลดอยู่แล้ว (`in` / `not.in`) · `joined=no` ยังจำกัดเฉพาะกิจกรรมที่เปิดรับ (RLS เดิม)

---

## 4. ฝั่ง staff (ช่วงส่งที่ 2)

### 4.1 navbar หน้าทั่วไปของครู/admin

- `HeaderAccountView` แบบ staff: เมนูกลาง (md+) "หน้าหลัก" → `/staff` · "กิจกรรม" → `/activities` · "บทความ" → `/articles` · "รางวัล" → `/rewards` · "อันดับ" → `/leaderboard` · กระดิ่ง → `/staff/notifications` · ไอคอนธีม · เมนูบัญชีเดิม ("หน้าผู้ดูแล", "โปรไฟล์", "ออกจากระบบ")
- `MainNav` รับ `items` (นักเรียน = `MAIN_NAV_ITEMS` เดิม, staff = `STAFF_MAIN_NAV_ITEMS`)
- แถบล่างมือถือใน `(student)` layout: staff ได้ "หน้าหลัก" (`/staff`) · "กิจกรรม" · "รางวัล" · "แจ้งเตือน" (`/staff/notifications`) · ตัดสินด้วยบทบาทใน `<Suspense>` (fallback = แถบของนักเรียนแบบไม่ไฮไลต์ เหมือนเดิม)
- ไม่ใส่ "ตะกร้า" (ครู/admin ใช้ตะกร้าไม่ได้) · `/staff/**` ไม่มีเมนูนี้

### 4.2 sidebar

- ไอคอน SVG เส้น (`stroke="currentColor"`, 20px, `aria-hidden`) ทุกเมนูใน `staff-nav-icons.tsx` (inline ไม่เพิ่ม dependency) รวมเมนูใหม่ "บัญชีนักเรียน" → `/staff/students` (กลุ่มหลัก ทั้งครูและ admin)
- ปุ่มล่างสุด "ยุบเมนู" / "กางเมนู" (`aria-expanded`, `aria-controls`) อยู่เหนือปุ่มธีม
- ยุบ: กว้าง 64px · แสดงไอคอนอย่างเดียว · ลิงก์มี `aria-label` = ชื่อเมนู · tooltip ตอน hover/focus-visible (CSS, ไม่บังลิงก์อื่น) · หัวข้อกลุ่ม "ผู้ดูแลระบบ" เป็นเส้นคั่นแทน · ปุ่มธีมแสดงแค่ไอคอน
- จำค่าในคุกกี้ `staff-sidebar=collapsed` (path `/staff`, 1 ปี, `SameSite=Lax`) · กดปุ่มแล้ว client เปลี่ยนทันทีและเขียนคุกกี้ (ไม่ต้อง refresh) · ตอน render layout อ่านคุกกี้ใน `<Suspense>` จึงเปิดหน้าใหม่ไม่กระพริบ · fallback = แบบกาง
- มือถือ: ลิ้นชักเดิม ไม่มีการยุบ · จุดชั่ง (`station`) ยังซ่อน sidebar ถึง xl ตามเดิม

### 4.3 หน้า `/staff`

- `greetingFor` เพิ่ม "สวัสดีตอนดึก": เช้า 05:00–10:59 · เที่ยง 11:00–12:59 · บ่าย 13:00–16:59 · เย็น 17:00–18:59 · ดึก 19:00–04:59 (Asia/Bangkok) ใช้ทั้ง `/staff` และ `/dashboard`
- ส่วนหัวแบบ dashboard นักเรียน (DESIGN-3 §4.5): คำทักทาย · รูป 72px · ป้ายบทบาท (`Badge`, "ครู"/"ผู้ดูแลระบบ") **หน้า**ชื่อ · อีเมล
- สถิติเดิม (`StaffStats`) ไม่เปลี่ยน
- กราฟ 2 ตัว ใน `<Suspense>` ของตัวเอง (fallback ขนาดเท่ากราฟ):
  - A `CarbonByMonth`: แท่ง 6 เดือนล่าสุดของปฏิทิน Bangkok รวมเดือนปัจจุบัน (เดือนที่ไม่มีข้อมูล = 0) ป้ายเดือนแบบ "พ.ย." · จาก `staff_carbon_by_month(6)`
  - B `WasteByCategory` เดิม (component ของนักเรียน) ข้อมูลทั้งโรงเรียนจาก `staff_waste_by_category()`
  - ทั้งคู่มีตารางซ่อน (`sr-only`) · ทุกค่าเป็น 0 → "ยังไม่มีข้อมูล" แทนกราฟ · โหลดไม่ได้ → ข้อความเตือนแบบ `StaffStats`
- เอาการ์ดเมนู (`MENU`, `ADMIN_MENU`) ออก

### 4.4 รายการ staff

ทุกหน้ามีปุ่ม "กลับ" → `/staff` ใน `PageHeader` (หน้าที่มีอยู่แล้วคงไว้) · หน้าละ 12 รายการ

| หน้า | ค้นหา | เรียงตาม | กรอง | อื่นๆ |
|---|---|---|---|---|
| `/staff/activities` | `title` | `date`: วันที่สร้าง ↓ · `participants`: จำนวนผู้เข้าร่วม ↓ · `name`: ชื่อ ↑ | `type` (3 ค่า) · `status`: ร่าง / เปิดรับ / ปิดรับ · `code`: ใช้รหัสจุดชั่ง / ไม่ใช้ | view `staff_activity_list` · ภาพปก/`CoverFallback` 96×64 ข้างรายละเอียด · ปุ่ม "ดู" → `/activities/[id]` (ไม่แสดงเมื่อเป็นร่าง) · ปุ่มเดิม (แก้ไข/ลบ) คงไว้ |
| `/staff/weigh-station` | ชื่อนักเรียน (เดิม) | `joined`: วันที่เข้าร่วม ↑ · `name`: ชื่อ ↑ | — | `searchParticipants` คืน `joinedAt` และ limit 200 · เรียง/แบ่งหน้าใน client state (ไม่ใช้ URL) · แสดง "เข้าร่วม {วันที่}" ใต้ชื่อ · ค้นหาใหม่/เปลี่ยนกิจกรรม → หน้า 1 |
| `/staff/orders` | ชื่อผู้สั่ง, เลขที่ (เดิม) | `date`: วันที่สั่ง ↑ · `points`: แต้ม ↓ · `buyer`: ชื่อผู้สั่ง ↑ | `status`: รอรับทั้งหมด (ค่าเริ่มต้น) / รอเตรียม / เตรียมของเสร็จ / รับแล้ว / ยกเลิก-หมดอายุ / ทั้งหมด | view `staff_order_list` · ค่าเริ่มต้นเห็นงานค้างเรียงเก่า → ใหม่ (เหมือนเดิม) · ปุ่มดำเนินการเดิม |
| `/staff/rewards` | `name` | `date`: วันที่เพิ่ม ↓ · `points`: แต้ม ↑ · `stock`: สต็อก ↓ · `name`: ชื่อ ↑ | `active`: เปิดการแลก / ปิดการแลก | ตาราง `rewards` |
| `/staff/articles` | `title` | `date`: วันที่ ↓ · `name`: ชื่อ ↑ | `category` (§5.1) | ภาพปก/`CoverFallback` 96×64 ข้างรายละเอียด · ป้ายประเภท |
| `/staff/notifications` | `title` | `date` ↓ · `name` ↑ | `type`: ผลที่ส่ง / ออเดอร์ | §3.1 ไม่มีเพดาน 100 |

- ค่า `status` ของ `/staff/orders`: `open` = `pending_pickup` ทั้งหมด (ค่าเริ่มต้น จึงต้องอยู่ใน URL เมื่อเลือก "ทั้งหมด": `status=all`) · `preparing` = `pending_pickup` และ `ready_at is null` · `ready` = `pending_pickup` และ `ready_at is not null` · `completed` · `closed` = `cancelled`/`expired`
  - config รองรับ `defaultFilter` ต่อหน้า (ค่าเริ่มต้นไม่ใส่ใน URL, "ทั้งหมด" = `all`)

---

## 5. ประเภทบทความ, ไอคอนปก, skeleton, วันที่ (ช่วงส่งที่ 3)

### 5.1 ประเภทบทความ

- `articles.category` (§7.2) ค่า `knowledge` "ให้ความรู้" · `announcement` "ประกาศ" · `other` "อื่นๆ" · `ARTICLE_CATEGORY_LABEL_TH` ใน `src/lib/articles/`
- ฟอร์ม staff: select "ประเภทบทความ" (ค่าเริ่ม ให้ความรู้) · validation รับเฉพาะ 3 ค่า · action สร้าง/แก้ไขบันทึก · `updateTag(ARTICLES_TAG)` เดิม
- ป้ายบนการ์ด/แถว `/articles`, `/staff/articles`, หน้า `/articles/[slug]` (แถว "โดย ชื่อ · วันที่ · ประเภท") · section บทความหน้าแรกไม่เปลี่ยน
- migration นี้ทำในช่วงส่งที่ 1 เพราะ `/articles` ใช้ตัวกรองประเภท (§9)

### 5.2 `CoverFallback` (แบบ B)

- `src/app/_components/cover-fallback.tsx`: `kind` = `waste` | `trees` | `fixed` | `article` · พื้นสีอ่อน + ไอคอนเส้น ขยะ / ต้นไม้ / ดาว / เอกสาร · `aria-hidden` (ข้อความชื่ออยู่ข้างๆ แล้ว)
- token ใหม่ใน `globals.css` ทั้งสองธีม: `--cover-waste`, `--cover-trees`, `--cover-fixed`, `--cover-article` (พื้น) + `-ink` (ไอคอน) · contrast ไอคอน/พื้น ≥ 3:1 ทั้งสองธีม
- แทนพื้น kraft + ใบไม้เดิมที่: การ์ด/แถว `/activities`, `/articles`, section กิจกรรมหน้าแรก (`home_open_activities` คืน `type` อยู่แล้ว), `/my-submissions`, `/staff/activities`, `/staff/articles` · หน้ารายละเอียด (`/activities/[id]`, `/articles/[slug]`) ที่ไม่มีภาพปกไม่แสดงภาพ (เดิม)

### 5.3 Skeleton

- เปลี่ยน `PageSkeleton` เป็นชุด skeleton ที่รูปร่างตรงกับหน้า `src/app/_components/skeletons.tsx`:
  - `ListSkeleton({ view, rows, toolbar })`: แถบเครื่องมือ + การ์ด 3/2/1 คอลัมน์ หรือแถวรายการ
  - `DetailSkeleton`: ภาพปก + หัวข้อ + 4 บรรทัด
  - `FormSkeleton({ fields })`
  - `DashboardSkeleton`: ส่วนหัว (รูปกลม + 2 บรรทัด) + สถิติ 3 กล่อง + กราฟ
  - `TableSkeleton({ rows })`
- ทุกตัว: `aria-busy="true"`, ข้อความ sr-only "กำลังโหลด..." (ข้อความเดิม), `motion-safe:animate-pulse`, พื้น `bg-paper-2`
- ใส่เป็น fallback ของ `<Suspense>` ที่หน้าใช้อยู่ (ไม่เพิ่ม `loading.tsx`) · หน้าที่ยังไม่มี `<Suspense>` รอบส่วนที่โหลดข้อมูลให้เพิ่ม
- แผนที่หน้า → skeleton: รายการทุกหน้า (§3, §4.4, `/leaderboard`, `/staff/reviews`, `/staff/users`, `/staff/students`) = List/Table · `[id]`/`[slug]` = Detail · `new`/`edit`/`/profile`/`/staff/profile`/`/staff/rates`/`/change-password` = Form · `/dashboard`, `/staff` = Dashboard · `/staff/reports` = Table · `/staff/weigh-station` = Form · `PageSkeleton` เดิมคงไว้เป็น fallback ของ `StaffGate` ใน layout
- ListSkeleton ใช้ `view` จาก URL ไม่ได้ตอน prerender → ใช้ค่าเริ่มต้นของหน้า

### 5.4 วันที่ วัน/เดือน/ปี

- `src/components/ui/date-input.tsx` (client) `DateInput({ name, defaultValue, required, min, max, id })`
  - ช่องข้อความแสดง `วว/ดด/ปปปป` ปี พ.ศ. (`inputMode="numeric"`, ใส่ `/` ให้อัตโนมัติขณะพิมพ์)
  - ปุ่มไอคอนปฏิทิน (aria "เลือกวันที่จากปฏิทิน") เปิด popover ที่ทำเอง: หัว "พฤศจิกายน 2569" + "เดือนก่อน"/"เดือนถัดไป" · ตาราง 7 คอลัมน์ (อา.–ส.) `role="grid"` · ลูกศรเลื่อนวัน, PageUp/PageDown เลื่อนเดือน, Enter เลือก, Esc ปิดแล้วโฟกัสกลับปุ่ม · วันนอก `min`/`max` กดไม่ได้
  - hidden input `name` ส่งค่า `YYYY-MM-DD` (ค.ศ.) เหมือน `<input type="date">` เดิม · ค่าไม่ถูกต้อง → hidden ว่าง + ข้อความ "วันที่ไม่ถูกต้อง (วว/ดด/ปปปป พ.ศ.)" (`aria-describedby`) · ฟอร์มไม่ส่งถ้า `required` และค่าว่าง
- `DateTimeInput`: `DateInput` + ช่อง "เวลา" `HH:mm` 24 ชม. → hidden `YYYY-MM-DDTHH:mm` (รูปแบบ `datetime-local` เดิม) · ใช้แทนช่องเริ่ม/จบในฟอร์มกิจกรรม
- `src/lib/thai-date.ts`: `parseThaiDate("06/11/2569") → "2026-11-06" | null` (ปี 2400–2700 เท่านั้น, ตรวจวันมีจริงรวมปีอธิกสุรทิน) · `formatThaiDate("2026-11-06") → "06/11/2569"` + test
- server action และ `src/lib/reports/range.ts` รับรูปแบบเดิม ไม่เปลี่ยน
- CSV รายงาน: คอลัมน์วันที่เป็น `วว/ดด/ปปปป` พ.ศ. (ข้อความ) ด้วย `formatThaiDate` · ตรวจข้อความวันที่ที่แสดงทุกหน้าว่าใช้ `formatBangkok` หรือรูปแบบไทย วัน เดือน ปี (ไม่มี `toLocaleDateString` แบบ en-US)

---

## 6. จัดการบัญชีนักเรียน (ช่วงส่งที่ 4)

### 6.1 หน้า

- `/staff/students` "บัญชีนักเรียน" (`requireStaff`)
  - ค้นหาชื่อ-นามสกุล/ชื่อที่แสดง/อีเมล · เรียง `date` วันที่สมัคร ↓ · `name` ชื่อ ↑ · `points` แต้ม ↓ · กรอง `status`: ปกติ / ถูกระงับ / ต้องเปลี่ยนรหัสผ่าน
  - แถว: รูป 36px + ชื่อ + อีเมล + แต้ม + ป้าย "ถูกระงับถึง 13 พ.ย. 2569 14:00" / "ระงับจนกว่าจะปลด" / "ต้องเปลี่ยนรหัสผ่าน" · ทั้งแถวเป็นลิงก์ไปหน้ารายละเอียด
  - ข้อมูลจาก `staff_list_students(...)` (§7.5) เพราะอีเมลอยู่ใน `auth.users`
- `/staff/students/[id]` (`requireStaff`, id ไม่ใช่ uuid หรือไม่ใช่นักเรียน → 404)
  - ส่วนหัว: รูป 72px · ชื่อ · ชื่อที่แสดง · อีเมล · วันที่สมัคร · แต้ม/carbon คงเหลือ
  - สถานะ: ปกติ หรือ ถูกระงับ (ถึงเมื่อไร, เหตุผล, โดยใคร)
  - แผงคำสั่งตามบทบาท (§6.2) · บัญชีที่ผู้ใช้ปัจจุบันจัดการไม่ได้ (กฎ demo §6.3) แสดงข้อความ "บัญชีสาธิตจัดการได้เฉพาะนักเรียนสาธิต" แทนแผงคำสั่ง
  - "ประวัติการจัดการบัญชี" 20 รายการล่าสุด: วันที่ · ผู้ทำ · คำสั่ง · เหตุผล/รายละเอียด
- `/staff/users/[id]` ของนักเรียน: เอา `AdjustForm` ออก ใส่ลิงก์ "จัดการบัญชีนักเรียน" แทน · `RoleForm` คงไว้

### 6.2 คำสั่ง

ทุกคำสั่งอยู่ใน `src/app/actions/accounts.ts`: ตรวจ `getCurrentUser()` + บทบาท → เรียกฟังก์ชันฐานข้อมูล (ตรวจซ้ำ + บันทึก `account_events`) → งานฝั่ง Auth ผ่าน admin client → `revalidatePath` หน้า · error เป็นข้อความไทยผ่าน `errorMessageTh`

| คำสั่ง | ครู | admin | รายละเอียด |
|---|---|---|---|
| รีเซ็ตรหัสผ่าน | ✓ | ✓ | dialog ยืนยัน → `staff_begin_password_reset(p_student)` ตั้ง `must_change_password` + บันทึก → `generateTempPassword()` → `auth.admin.updateUserById(id, { password })` → แสดงรหัสครั้งเดียวใน dialog (`font-mono` ตัวใหญ่ + `CopyLinkButton` แบบคัดลอกข้อความ) ข้อความ "ให้รหัสนี้กับนักเรียน รหัสจะแสดงครั้งเดียว นักเรียนต้องตั้งรหัสใหม่หลังเข้าสู่ระบบ" · รหัสไม่ถูกเก็บ ไม่ log ไม่อยู่ใน URL · ถ้าขั้น Auth ล้มเหลว → "รีเซ็ตรหัสผ่านไม่สำเร็จ ลองอีกครั้ง" (ธงที่ตั้งไปแล้วไม่เป็นอันตราย) |
| ระงับ | ✓ | ✓ | ฟอร์ม: ระยะเวลา (radio) 1 / 3 / 7 / 30 วัน / กำหนดเอง (1–365) / จนกว่าจะปลด · เหตุผล (บังคับ, 1–500 ตัว) → `staff_suspend_student(p_student, p_days, p_reason)` (`p_days` null = จนกว่าจะปลด) → `updateUserById(id, { ban_duration: "{days*24}h" | "876000h" })` · ถูกระงับอยู่แล้ว → แก้ระยะเวลา/เหตุผลได้ (บันทึกใหม่) |
| ยกเลิกระงับ | ✓ | ✓ | `staff_unsuspend_student(p_student)` → `ban_duration: "none"` |
| แก้ชื่อ | — | ✓ | ชื่อ-นามสกุล + ชื่อที่แสดง กฎเดียวกับ `src/lib/profile/validation.ts` → `admin_set_student_name(...)` |
| ปรับแต้ม | — | ✓ | `AdjustForm` + `adjust_ledger` เดิม (ห้ามติดลบ ต้องใส่เหตุผล) |
| ลบบัญชี | — | ✓ | dialog: พิมพ์ชื่อ-นามสกุลของนักเรียนให้ตรงเพื่อเปิดปุ่ม "ลบบัญชีถาวร" → `admin_check_student_delete(p_student)` (ตรวจ + คืนชื่อ) → `auth.admin.deleteUser(id)` (cascade + คืนสต็อกเดิมของ phase 2) → `admin_record_student_deleted(p_student, p_name)` → redirect `/staff/students?deleted=1` แสดง "ลบบัญชีแล้ว" |

- ขั้นฐานข้อมูลสำเร็จแต่ขั้น Auth ล้มเหลว (ระงับ/ยกเลิก): ฐานข้อมูลเป็นตัวตัดสิน (§6.4) จึงยังมีผล · แสดง "บันทึกแล้ว แต่ระบบเข้าสู่ระบบยังไม่อัปเดต กดอีกครั้ง" · คำสั่งซ้ำได้โดยไม่เสียหาย
- `generateTempPassword()` (`src/lib/accounts/temp-password.ts`): 10 ตัวจาก `ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789` ด้วย `crypto.getRandomValues` (rejection sampling) · มีตัวอักษรและตัวเลขอย่างน้อยอย่างละตัว · ผ่าน `MIN_PASSWORD_LENGTH` เดิม + test

### 6.3 กฎสิทธิ์ (บังคับในฐานข้อมูล)

- เป้าหมายต้องมี `role = 'student'` · ห้ามทำกับตัวเอง
- ครู: รีเซ็ตรหัส, ระงับ, ยกเลิกระงับ · admin: ทุกคำสั่ง
- ผู้ทำที่ `is_demo = true` ทำได้เฉพาะนักเรียนที่ `is_demo = true`
- `account_events` อ่านได้เฉพาะ staff · ไม่มีใครแก้/ลบได้ (ไม่มี policy update/delete, เขียนผ่านฟังก์ชันเท่านั้น) · student_id ไม่เป็น FK (ประวัติยังอยู่หลังลบ)

### 6.4 การบังคับใช้

- `getCurrentUser()` อ่าน `account_status` แถวของตัวเองพร้อม profile (query เดียว embed) แล้วเพิ่ม `suspendedUntil: string | null`, `mustChangePassword: boolean` ใน `CurrentUser`
  - ระงับอยู่ (`suspended_until > now()`) → คืน `null` (ทุกหน้าเห็นเป็นยังไม่เข้าสู่ระบบ) และ `requireUser` redirect `/auth/signout?reason=suspended`
  - `/auth/signout` (route handler, POST และ GET แบบมี `reason` เท่านั้น): `signOut()` แล้ว redirect `/login?error=suspended`
- หน้าเข้าสู่ระบบ: `?error=suspended` หรือ Auth ตอบ `user_banned` → "บัญชีนี้ถูกระงับ ติดต่อครูหรือผู้ดูแล"
- `mustChangePassword`: `requireUser` redirect `/change-password` (ยกเว้นหน้านั้นเอง) · server action ที่เรียก `requireUser`/`getCurrentUser` ตรวจด้วย helper `assertActiveUser()` ปฏิเสธด้วย "ต้องตั้งรหัสผ่านใหม่ก่อน"
- `/change-password` (กลุ่ม `(auth)`, ต้องเข้าสู่ระบบ): "ตั้งรหัสผ่านใหม่" · รหัสผ่านใหม่ + ยืนยันรหัสผ่าน (`PasswordInput`) · `updateUser({ password })` → `clear_must_change_password()` → ไป `/staff` หรือ `/dashboard` ตามบทบาท · ไม่มีธง → redirect ตามบทบาท
- หน้าอันดับ: `leaderboard` ข้ามนักเรียนที่ระงับอยู่ (§7.5)
- ความเสี่ยงที่ยอมรับ: access token ที่ออกก่อนระงับยังเรียก API ตรงได้ ≤ 1 ชม. (อายุ JWT) · หน้าเว็บตัดทันที · ไม่แก้ฟังก์ชันฐานข้อมูลเดิม

---

## 7. ฐานข้อมูล

ทุกฟังก์ชันใหม่: `security definer`, `set search_path = ''`, `revoke execute ... from public, anon` แล้ว `grant` ให้ `authenticated` · ตรวจ `auth.uid()` และบทบาทเอง · ฟังก์ชันที่เขียนข้อมูลไม่แตะยอดแต้ม จึงไม่ล็อก profile (ยกเว้น `adjust_ledger` เดิม) · ทุก view: `with (security_invoker = true)` และ `grant select ... to authenticated`

### 7.1 `0032_notifications_manage.sql`

- `grant delete on public.notifications to authenticated` + policy `notifications_delete_own` (`user_id = (select auth.uid())`)
- index `(user_id, created_at desc, id desc)`
- trigger `notifications_cap` (after insert, for each row): ถ้าผู้รับเป็น `student` ลบแถวของผู้รับที่อยู่ลำดับเกิน 100 (เรียง `created_at desc, id desc`) · ทำงานในฟังก์ชัน security definer · ไม่ล็อก profile (อ่าน role อย่างเดียว) · หมายเหตุลำดับการล็อกต่อท้ายหัวข้อของ 0016
- ตัดของเดิมที่เกิน 100 ของนักเรียนทุกคนตอนรัน migration
- `public.notifications` อยู่ใน publication Realtime อยู่แล้ว ไม่เปลี่ยน

### 7.2 `0033_article_category.sql`

- `alter table public.articles add column category text not null default 'knowledge' check (category in ('knowledge','announcement','other'))` + index `(published, category)` (ตารางนี้ไม่มี column grant จึงไม่ต้องเพิ่ม)

### 7.3 `0034_list_views.sql`

- `my_submission_list`: submission ของ `auth.uid()` (RLS เดิมของ submissions) + `activity_id`, `activity_title`, `activity_type`, `activity_cover_path`, `status`, `status_rank` (pending 1, approved 2, rejected 3), `points` (ผลรวม ledger `earn` ที่อ้าง submission นี้, null ถ้ายังไม่มี), `grams` (ผลรวม `submission_items.quantity` เมื่อ type = waste, อื่นๆ null), `trees`, `reject_reason`, `created_at`
- `my_order_list`: ออเดอร์ของผู้เรียก + `item_names` (`string_agg(reward_name, ' ')`) + คอลัมน์ที่ `/orders` แสดงอยู่
- `staff_activity_list`: คอลัมน์ของ `activities` ที่หน้าใช้ + `participant_count`
- `staff_order_list`: คอลัมน์ที่ `/staff/orders` ใช้ + `buyer_name` (`coalesce(nullif(trim(display_name),''), full_name)`), `status_group` (`preparing`/`ready`/`completed`/`closed`)
- RLS ของตารางต้นทางมีผลผ่าน `security_invoker` · pgTAP ตรวจว่านักเรียนไม่เห็นแถวของคนอื่น และ view staff ว่างสำหรับนักเรียน

### 7.4 `0035_staff_charts.sql`

- `staff_carbon_by_month(p_months int default 6) returns table (month date, carbon_kg numeric)` · `is_staff()` เท่านั้น (อื่นๆ → error `not_staff`) · clamp 1–24 · ผลรวม `ledger_entries.carbon_kg` ของ `kind = 'earn'` ตามเดือนปฏิทิน Asia/Bangkok ของ `created_at` · คืนครบทุกเดือน (ไม่มี → 0) เรียงเก่า → ใหม่ · `stable`
- `staff_waste_by_category() returns table (code text, name text, grams bigint)` · `is_staff()` · ผลรวม `submission_items.quantity` ของ submission ที่ `approved` ในกิจกรรม `waste` แยกตาม `waste_categories` ทั้ง 4 กลุ่ม (ไม่มี → 0) เรียงตาม `sort_order`/code เดิม · `stable`

### 7.5 `0036_student_accounts.sql`

- `account_status` (`student_id uuid primary key references profiles on delete cascade`, `suspended_until timestamptz` (`'infinity'` = จนกว่าจะปลด), `suspend_reason text check (char_length <= 500)`, `suspended_by uuid`, `must_change_password boolean not null default false`, `updated_at timestamptz not null default now()`)
  - RLS: select ของตัวเองหรือ `is_staff()` · ไม่มี insert/update/delete ให้ client
- `account_events` (`id uuid pk`, `student_id uuid not null` (ไม่ใช่ FK), `student_name text not null`, `actor_id uuid`, `actor_name text not null`, `action text check in ('password_reset','suspend','unsuspend','rename','delete')`, `detail text`, `created_at timestamptz default now()`) + index `(student_id, created_at desc)` · RLS select `is_staff()` เท่านั้น
- ฟังก์ชัน (ทุกตัวตรวจกฎ §6.3 · error code: `not_staff`, `not_admin`, `not_student`, `demo_scope`, `self_target`, `invalid_input`):
  - `staff_list_students(p_q text, p_sort text, p_dir text, p_status text, p_limit int, p_offset int) returns table (..., total bigint)` · join `auth.users` (email, created_at) + `student_balance` + `account_status` · sort/dir/status ตรวจจาก whitelist · ค้นหา ilike ชื่อ/ชื่อที่แสดง/อีเมล (escape) · `stable`
  - `staff_get_student(p_student)` · `staff_list_account_events(p_student, p_limit)`
  - `staff_begin_password_reset(p_student)` · `staff_suspend_student(p_student, p_days int, p_reason text)` (`p_days` null หรือ 1–365) · `staff_unsuspend_student(p_student)`
  - `admin_set_student_name(p_student, p_full_name, p_display_name)` (กฎเดียวกับ profile เดิม)
  - `admin_check_student_delete(p_student) returns text` (ชื่อ) · `admin_record_student_deleted(p_student, p_name)` (ต้องไม่มี profile id นี้แล้ว)
  - `clear_must_change_password()` ของ `auth.uid()` เท่านั้น
- `leaderboard(p_period, p_now)`: drop + create ใหม่จากนิยามล่าสุด (0027) เพิ่มเงื่อนไขข้ามนักเรียนที่ `suspended_until > p_now` · ผลลัพธ์/สิทธิ์/grant เดิม · `public_stats` ไม่เปลี่ยน (ยอดรวมทั้งโรงเรียนยังนับ)

### 7.6 pgTAP (ไฟล์ใหม่)

- `notifications_manage.test.sql`: ลบของตัวเองได้ ของคนอื่นไม่ได้ · anon ไม่ได้ · นักเรียนแจ้งเตือนที่ 101 → เหลือ 100 และอันที่หายคือเก่าสุด · ครูไม่ถูกตัด
- `article_category.test.sql`: ค่าเริ่มต้น `knowledge` · ค่าอื่น fail
- `list_views.test.sql`: แต่ละ view เห็นเฉพาะแถวตาม RLS · `points`/`grams`/`participant_count`/`buyer_name`/`status_group` ถูก · `security_invoker` เปิด
- `staff_charts.test.sql`: นักเรียน/anon เรียกไม่ได้ · เดือนว่างเป็น 0 · ขอบเดือน Bangkok (23:30 วันสุดท้ายของเดือน UTC) · นับเฉพาะ approved/earn
- `student_accounts.test.sql`: ตารางกฎ §6.3 ครบทุกคำสั่ง × บทบาท × demo · ตัวเอง/staff เป็นเป้าหมาย fail · เหตุผลว่าง/ยาวเกิน, `p_days` 0/366 fail · event ถูกบันทึก, แก้/ลบไม่ได้ · `clear_must_change_password` ล้างได้แค่ของตัวเอง · `leaderboard` ข้ามคนที่ระงับอยู่ และกลับมาเมื่อพ้นกำหนด · `staff_list_students` ค้นหา/เรียง/กรอง/total

---

## 8. การทดสอบ

- **gate** HANDOFF §9 ครบ (หลัง `npx supabase db reset`) + `node tests/redesign/check-scope.mjs` + build: `/` และ `/articles` ยังเป็น ◐
- **vitest**: `parseListParams`/`listHref` แบบ config (ค่าขยะ, `new`/`old` เดิม, `defaultFilter`, เปลี่ยนตัวกรองกลับหน้า 1) · `sortRows`/`paginateRows` (ไทย ก-ฮ, null ท้าย) · `cartRemainder` · `greetingFor` (04:59, 05:00, 10:59, 11:00, 12:59, 13:00, 16:59, 17:00, 18:59, 19:00) · `parseThaiDate`/`formatThaiDate` (29/02/2567 ได้, 29/02/2568 ไม่ได้, 31/04, ปี 2026 ไม่ได้) · `generateTempPassword` (ความยาว, ตัวอักษรที่อนุญาต, มีตัวเลขและตัวอักษร) · CSV วันที่ใหม่ · render `HeaderAccountView` แบบ staff (เมนูกลาง 5 รายการ ไม่มีตะกร้า) · `DateInput` (พิมพ์ → hidden ค่า ค.ศ., ค่าผิด → ข้อความ error)
- **e2e** (chromium + mobile-chrome):
  - ช่วง 1: ทุกหน้าใน §3 ค้นหา/เรียง (ทั้งสองทิศ)/กรอง/แบ่งหน้า (seed 13+ รายการ) · URL ถูกต้อง · ลบแจ้งเตือน/ลบที่อ่านแล้วทั้งหมด (กระดิ่งลดลง) · บรรทัดแต้มในตะกร้า (พอ/ไม่พอ) · ผลที่ส่ง: กดภาพปกไปหน้ากิจกรรม · ไม่มี JS: form GET ยังทำงาน
  - ช่วง 2: ครูที่ `/activities` เห็นเมนูกลาง 5 รายการ "หน้าหลัก" ไป `/staff` · แถบล่างมือถือของครู · sidebar ยุบ → รีโหลดยังยุบ → กางกลับ · tooltip/aria-label เมื่อยุบ · `/staff` คำทักทาย (`page.clock` 19:30 → "สวัสดีตอนดึก") + ป้ายบทบาท + กราฟสองตัว + ไม่มีการ์ดเมนู · รายการ staff ทุกหน้าใน §4.4 · จุดชั่งเรียงชื่อและเปลี่ยนหน้า
  - ช่วง 3: ประเภทบทความ (สร้างเป็น "ประกาศ" → กรองที่ `/articles` เจอ) · ไอคอนปกตาม type · skeleton แสดงระหว่างโหลด (route ที่หน่วงด้วย `page.route`) · `DateInput` พิมพ์และเลือกจากปฏิทินในหน้ารายงานและฟอร์มกิจกรรม แล้วบันทึกได้ค่าเดิม
  - ช่วง 4: ครูเห็นแค่ รีเซ็ต/ระงับ · admin เห็นครบ · รีเซ็ต → เข้าสู่ระบบด้วยรหัสชั่วคราว → ถูกพาไป `/change-password` → ตั้งรหัสใหม่ → ใช้งานได้ · ระงับ 1 วัน → session ของนักเรียน (อีก context) ถูกพาไป `/login` พร้อมข้อความ → เข้าสู่ระบบไม่ได้ → ยกเลิกระงับ → เข้าได้ · ระงับแล้วหายจากอันดับ · ลบบัญชี (พิมพ์ชื่อผิดปุ่มปิด) · admin สาธิตจัดการนักเรียนจริงไม่ได้
  - ทุกช่วง: 360px ไม่มี horizontal scroll · id ไม่ซ้ำหลังสลับหน้า (`<Activity>`)
- test เดิมที่อิง "เรียง", ตัวเลือก "ใหม่ → เก่า" ใน select, การ์ดเมนู `/staff`, `AdjustForm` ใน `/staff/users/[id]`, `limit(50)` ของแจ้งเตือน ปรับตาม spec นี้

---

## 9. ลำดับงาน (รายละเอียดในแผน)

**ช่วง 1: หน้าฝั่งนักเรียน**
1. migration 0032–0034 + pgTAP + check-scope (§1.2/§1.3)
2. ชุดรายการกลางแบบ config + แถบเครื่องมือแบบ B + ย้าย `/articles` (รวมตัวกรองประเภท) และ `/activities`
3. `/notifications` (ลบ, เพดาน, ค้นหา/เรียง/กรอง/แบ่งหน้า)
4. `/orders`, `/rewards`
5. `/my-submissions`, `/cart`
6. รีวิวรวมช่วง 1 → เจ้าของตอบ "ตรงใจ"

**ช่วง 2: ฝั่ง staff**
7. migration 0035 + pgTAP · navbar ครู/admin (เมนูกลาง + แถบล่าง)
8. sidebar ยุบ/กาง + ไอคอน · หน้า `/staff` (คำทักทาย, ส่วนหัว, กราฟ)
9. `/staff/activities`, `/staff/weigh-station`
10. `/staff/orders`, `/staff/rewards`, `/staff/articles`, `/staff/notifications`
11. รีวิวรวมช่วง 2 → "ตรงใจ"

**ช่วง 3**
12. ประเภทบทความ (ฟอร์ม staff, ป้าย) + `CoverFallback` ทุกที่
13. skeleton ทุกหน้า
14. `DateInput`/`DateTimeInput` + CSV วันที่ + ไล่ตรวจวันที่ทั่วแอป
15. รีวิวรวมช่วง 3 → "ตรงใจ"

**ช่วง 4**
16. migration 0036 + pgTAP + การบังคับใช้ใน DAL, `/auth/signout`, `/change-password`, ข้อความหน้าเข้าสู่ระบบ
17. `/staff/students` + `/staff/students/[id]` + คำสั่งทั้งหมด + ย้าย `AdjustForm`
18. รีวิวรวมทั้งรอบ + Impeccable audit/polish + บันทึกผลใน §10

## 10. ผลตรวจ build ปิดงาน

กรอกตอนปิดงาน (Task 18): ตาราง gate, บรรทัด build ของ `/`, `/articles`, `use-cache-count`, ปัญหาที่ทราบ, ผล audit

## 11. สิ่งที่เจ้าของต้องทำบน Supabase Cloud

1. รัน migration 0032–0036 (`npx supabase db push`)
2. ตรวจการเรียงภาษาไทยใน SQL editor: `select string_agg(x, ' ' order by x) from unnest(array['ข้าว','กระดาษ','เกม','ไก่','ฮา']) x;` ต้องได้ `กระดาษ เกม ไก่ ข้าว ฮา` · ถ้าไม่ตรง แจ้ง Claude (จะเพิ่ม migration ใส่ `collate "th-x-icu"` ให้คอลัมน์ชื่อ)
3. ตรวจ Authentication → Email → "Secure password change" ยังปิดอยู่ (DESIGN-3 §11 ข้อ 5) เพราะ `/change-password` ใช้ `updateUser({ password })`
4. หลังสาธิต: ดู "ประวัติการจัดการบัญชี" ว่าบัญชีสาธิตไม่ได้ทำอะไรผิดปกติ แล้วรัน `demo:purge` ตามเดิม
