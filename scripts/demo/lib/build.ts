import { randomBytes, randomUUID } from "node:crypto";
import { DEMO_EMAILS, SEED_EMAIL_SUFFIX, SEED_PREFIX, SEED_SLUG_PREFIX, type Ctx } from "./context.ts";
import { asUser, assertUuid, lit, uuidArray } from "./db.ts";
import { DEMO_NAMES, SEED_STUDENT_NAMES } from "./names.ts";
import { placeholderPng } from "./png.ts";

// Insert the demo data (R137). Run after removeSeedData(), so the result is the same every time.
//
// 1. Auth admin API: 30 seed students (random passwords, never stored) + 3 demo accounts (DEMO_PASSWORD),
//    all e-mail-confirmed. Storage API: one placeholder picture per planned submission, in the student's
//    own evidence folder (submit_result requires the object to exist).
// 2. One pg transaction as postgres. Roles / is_demo are set while auth.uid() is null (0002 trigger).
//    Every business step goes through the real domain functions as the acting user (asUser):
//    join_activity, issue_weigh_code, submit_result, approve_submission / reject_submission, the cart insert
//    (RLS) + checkout, mark_order_ready / complete_order / cancel_order. Points and carbon therefore come
//    only from approve_submission with the rates in waste_categories (0003) and each activity's unit values.
//    After each step the timestamps are moved back (as postgres) so the history spreads over ~3 months.
//    I3 (demo timing): part of the history is anchored to the CURRENT Bangkok month at seed time, so
//    /leaderboard "เดือนนี้", the demo student's rank card and /staff/reports' default month (ended
//    activities by ends_at) have data whenever the reset runs: the beach clean-up (e4) ends inside this
//    month, and the open weigh activity (o1) has approved waste results (carbon) from this month, the demo
//    student's included. Run demo:reset on the morning of the demo (docs/demo-checklist.md).
// 3. The 4 ended activities are created as draft and opened inside the transaction only so join_activity
//    accepts them; their activity_opened notifications are deleted again in the same transaction (so none
//    persist), then they are closed and moved to their real past dates. The 2 open activities are opened
//    once, near the end (one activity_opened notification per student each).
// 4. Notifications the steps generate for users OUTSIDE the seed domain (real staff get submission_new /
//    order_new, real students get activity_opened) are deleted before the commit: the seed leaves nothing
//    on real users.

const DAY = 24 * 60 * 60_000;
const HOUR = 60 * 60_000;
const MINUTE = 60_000;
const BANGKOK_OFFSET = 7 * HOUR; // Asia/Bangkok has no DST

/** Start of the Bangkok calendar month containing `ms` (as epoch ms). */
export function bangkokMonthStart(ms: number): number {
  const d = new Date(ms + BANGKOK_OFFSET);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - BANGKOK_OFFSET;
}

/**
 * Real start/end of an activity at seed time. `endsInCurrentMonth` activities end no earlier than the start of
 * the current Bangkok month (still in the past), so the reports' default month always has an ended activity.
 */
function activityWindow(a: ActDef, now: number): { start: number; end: number } {
  const start = now - a.startsDaysAgo * DAY;
  let end = now - a.endsDaysAgo * DAY;
  if (a.endsInCurrentMonth) {
    const monthStart = bangkokMonthStart(now);
    if (end < monthStart) end = monthStart + Math.min(HOUR, (now - monthStart) / 2);
  }
  return { start, end };
}

type Person = { id: string; name: string; email: string; demo: boolean };
type ActKey = "e1" | "e2" | "e3" | "e4" | "o1" | "o2";
type ActDef = {
  key: ActKey;
  title: string;
  type: "waste" | "trees" | "fixed";
  requiresCode: boolean;
  unitPoints: number;
  maxPerSubmission: number | null;
  startsDaysAgo: number;
  endsDaysAgo: number; // negative = in the future
  /** I3: keep the end inside the current Bangkok month (see activityWindow). */
  endsInCurrentMonth?: boolean;
  location: string;
  offsite: boolean;
  description: string;
};
type Item = { cat?: string; qty: number };
type Sub = {
  act: ActKey;
  student: Person;
  items: Item[];
  outcome: "approved" | "pending" | "rejected";
  createdAt: number;
  reviewedAt?: number;
  path: string;
  variant: number;
};

const NO_CARBON_NOTE =
  "ยังไม่มีค่า carbon ต่อต้นที่ตรวจสอบได้ (ดู docs/carbon-sources.md) จึงไม่นับ carbon ของกิจกรรมนี้ นับเฉพาะแต้ม";

const ACTIVITIES: ActDef[] = [
  {
    key: "e1",
    title: `${SEED_PREFIX}อบรมคัดแยกขยะก่อนทิ้ง`,
    type: "fixed",
    requiresCode: false,
    unitPoints: 15,
    maxPerSubmission: null,
    startsDaysAgo: 88,
    endsDaysAgo: 74,
    location: "หอประชุมโรงเรียน",
    offsite: false,
    description: "ข้อมูลตัวอย่างสำหรับสาธิต: อบรมการคัดแยกขยะ 4 ประเภท เข้าร่วมแล้วส่งรูปถ่ายในงาน ได้แต้มคงที่ (ไม่นับ carbon)",
  },
  {
    key: "e2",
    title: `${SEED_PREFIX}ปลูกต้นไม้รอบสนามกีฬา`,
    type: "trees",
    requiresCode: false,
    unitPoints: 10,
    maxPerSubmission: 10,
    startsDaysAgo: 60,
    endsDaysAgo: 46,
    location: "สนามกีฬาโรงเรียน",
    offsite: false,
    description: `ข้อมูลตัวอย่างสำหรับสาธิต: ปลูกต้นไม้ ต้นละ 10 แต้ม ${NO_CARBON_NOTE}`,
  },
  {
    key: "e3",
    title: `${SEED_PREFIX}ธนาคารขยะรีไซเคิลประจำเดือน`,
    type: "waste",
    requiresCode: true,
    unitPoints: 0,
    maxPerSubmission: 20000,
    startsDaysAgo: 40,
    endsDaysAgo: 5,
    location: "จุดชั่งขยะ ข้างโรงอาหาร",
    offsite: false,
    description: "ข้อมูลตัวอย่างสำหรับสาธิต: นำขยะที่คัดแยกแล้วมาชั่ง รับรหัสจากครูที่จุดชั่ง แต้มและ carbon คิดจากอัตราของแต่ละกลุ่มขยะ",
  },
  {
    key: "e4",
    title: `${SEED_PREFIX}เก็บขยะชายหาด`,
    type: "fixed",
    requiresCode: false,
    unitPoints: 30,
    maxPerSubmission: null,
    startsDaysAgo: 9,
    endsDaysAgo: 2,
    endsInCurrentMonth: true,
    location: "ชายหาดใกล้โรงเรียน",
    offsite: true,
    description: "ข้อมูลตัวอย่างสำหรับสาธิต: กิจกรรมนอกสถานที่ ส่งรูปการเก็บขยะ ได้แต้มคงที่ (ไม่นับ carbon)",
  },
  {
    key: "o1",
    title: `${SEED_PREFIX}จุดชั่งขยะรีไซเคิลประจำสัปดาห์`,
    type: "waste",
    requiresCode: true,
    unitPoints: 0,
    maxPerSubmission: 20000,
    startsDaysAgo: 2,
    endsDaysAgo: -12,
    location: "จุดชั่งขยะ ข้างโรงอาหาร",
    offsite: false,
    description: "ข้อมูลตัวอย่างสำหรับสาธิต: เปิดรับอยู่ นำขยะมาชั่งแล้วขอรหัส 6 หลักจากครูที่จุดชั่งก่อนส่งผล",
  },
  {
    key: "o2",
    title: `${SEED_PREFIX}ปลูกต้นไม้วันสิ่งแวดล้อม`,
    type: "trees",
    requiresCode: false,
    unitPoints: 10,
    maxPerSubmission: 10,
    startsDaysAgo: 1,
    endsDaysAgo: -20,
    location: "แปลงต้นไม้หลังอาคาร 3",
    offsite: false,
    description: `ข้อมูลตัวอย่างสำหรับสาธิต: เปิดรับอยู่ ปลูกต้นไม้แล้วส่งรูป ต้นละ 10 แต้ม ${NO_CARBON_NOTE}`,
  },
];

const REWARDS: { key: string; name: string; cost: number; stock: number }[] = [
  { key: "pencil", name: "ดินสอไม้รีไซเคิล", cost: 30, stock: 40 },
  { key: "seedling", name: "ต้นกล้าไม้ประดับในกระถาง", cost: 40, stock: 15 },
  { key: "notebook", name: "สมุดกระดาษรีไซเคิล", cost: 50, stock: 30 },
  { key: "straw", name: "หลอดสแตนเลสพร้อมแปรงล้าง", cost: 60, stock: 20 },
  { key: "bag", name: "ถุงผ้าลดโลกร้อน", cost: 80, stock: 25 },
  { key: "lunchbox", name: "กล่องข้าวพกพา", cost: 120, stock: 12 },
  { key: "bottle", name: "กระบอกน้ำสแตนเลส", cost: 150, stock: 10 },
  { key: "coupon", name: "คูปองโรงอาหาร 20 บาท", cost: 100, stock: 0 },
];

const ARTICLES: { slug: string; title: string; body: string; published: boolean; daysAgo: number }[] = [
  {
    slug: `${SEED_SLUG_PREFIX}sort-waste`,
    title: `${SEED_PREFIX}คัดแยกขยะ 4 กลุ่มในโรงเรียน`,
    published: true,
    daysAgo: 85,
    body: [
      "ขยะในโรงเรียนแบ่งเป็น 4 กลุ่ม: พลาสติก กระดาษ โลหะ/แก้ว และขยะทั่วไป/อื่นๆ",
      "ล้างขวดและกล่องให้สะอาด ทำให้แห้ง แล้วแยกใส่ถุงตามกลุ่มก่อนนำไปที่จุดชั่ง",
      "บทความนี้เป็นข้อมูลตัวอย่างสำหรับการสาธิตระบบ",
    ].join("\n\n"),
  },
  {
    slug: `${SEED_SLUG_PREFIX}weigh-station`,
    title: `${SEED_PREFIX}ส่งผลที่จุดชั่งทำอย่างไร`,
    published: true,
    daysAgo: 38,
    body: [
      "1. กดเข้าร่วมกิจกรรมในเว็บ",
      "2. นำขยะไปชั่งที่จุดชั่ง ครูจะออกรหัส 6 หลักให้ รหัสใช้ได้ 30 นาทีและใช้ได้ครั้งเดียว",
      "3. ถ่ายรูปขยะบนตาชั่ง กรอกน้ำหนักและรหัส แล้วกดส่งผล",
      "4. รอครูตรวจ เมื่ออนุมัติแล้วจะได้แต้มและมีแจ้งเตือนเด้งขึ้นมา",
      "บทความนี้เป็นข้อมูลตัวอย่างสำหรับการสาธิตระบบ",
    ].join("\n\n"),
  },
  {
    slug: `${SEED_SLUG_PREFIX}carbon-values`,
    title: `${SEED_PREFIX}ค่า carbon ในเว็บนี้มาจากไหน`,
    published: true,
    daysAgo: 20,
    body: [
      "ค่าการลดก๊าซเรือนกระจกของพลาสติกและกระดาษมาจากเอกสารขององค์การบริหารจัดการก๊าซเรือนกระจก (อบก.)",
      "ค่าของโลหะ/แก้ว และขยะทั่วไป/อื่นๆ เป็นค่าประมาณ ระบบแสดงป้าย \"ค่าประมาณ\" กำกับไว้ ส่วนกิจกรรมปลูกต้นไม้ยังไม่นับ carbon เพราะยังไม่มีค่าต่อต้นที่ตรวจสอบได้",
      "บทความนี้เป็นข้อมูลตัวอย่างสำหรับการสาธิตระบบ",
    ].join("\n\n"),
  },
  {
    slug: `${SEED_SLUG_PREFIX}draft-tree-day`,
    title: `${SEED_PREFIX}(ฉบับร่าง) แผนกิจกรรมปลูกต้นไม้เดือนหน้า`,
    published: false,
    daysAgo: 1,
    body: "ฉบับร่างตัวอย่าง: ยังไม่เผยแพร่",
  },
];

const REJECT_REASON = "รูปไม่ชัด มองไม่เห็นถุงขยะ ถ่ายใหม่ให้เห็นชัดแล้วส่งอีกครั้ง";

/** Deterministic pseudo-random numbers (mulberry32), so every run plans the same rows. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function createUsers(ctx: Ctx): Promise<{ students: Person[]; demoStudent: Person; teacher: Person; adminUser: Person }> {
  const make = async (email: string, name: string, password: string, demo: boolean): Promise<Person> => {
    const { data, error } = await ctx.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !data.user) throw new Error(`auth createUser failed: ${error?.message}`);
    return { id: assertUuid(data.user.id), name, email, demo };
  };
  const students: Person[] = [];
  for (let i = 0; i < SEED_STUDENT_NAMES.length; i++) {
    const email = `student${String(i + 1).padStart(2, "0")}${SEED_EMAIL_SUFFIX}`;
    // seed students are data only: a random password that is never stored or printed
    students.push(await make(email, SEED_STUDENT_NAMES[i], randomBytes(24).toString("base64url"), false));
  }
  const demoStudent = await make(DEMO_EMAILS.student, DEMO_NAMES.student, ctx.demoPassword, true);
  const teacher = await make(DEMO_EMAILS.teacher, DEMO_NAMES.teacher, ctx.demoPassword, true);
  const adminUser = await make(DEMO_EMAILS.admin, DEMO_NAMES.admin, ctx.demoPassword, true);
  return { students, demoStudent, teacher, adminUser };
}

/** Every submission of the history, planned up front (the pictures are uploaded before the transaction). */
function planSubmissions(students: Person[], demo: Person, cats: Record<string, string>, now: number): {
  subs: Sub[];
  joins: Record<ActKey, Person[]>;
} {
  const r = rng(20261021);
  const between = (a: number, b: number) => a + r() * (b - a);
  const act = (k: ActKey) => ACTIVITIES.find((a) => a.key === k)!;
  const window = (k: ActKey) => {
    const w = activityWindow(act(k), now);
    const start = w.start + 12 * HOUR;
    const end = Math.min(w.end, now - 6 * HOUR);
    return { start, end: Math.max(end, start) };
  };
  const reviewTime = (created: number, k: ActKey) => {
    const cap = Math.min(activityWindow(act(k), now).end + 3 * DAY, now - 3 * HOUR);
    // never before the submission, never in the future (a reset right after midnight squeezes the window)
    return Math.min(Math.max(Math.min(created + between(2, 40) * HOUR, cap), created + MINUTE), now - MINUTE);
  };
  const subs: Sub[] = [];
  const joins: Record<ActKey, Person[]> = { e1: [], e2: [], e3: [], e4: [], o1: [], o2: [] };
  let variant = 0;
  const add = (k: ActKey, student: Person, items: Item[], outcome: Sub["outcome"], createdAt: number, reviewedAt?: number) => {
    subs.push({
      act: k,
      student,
      items,
      outcome,
      createdAt,
      reviewedAt: outcome === "pending" ? undefined : (reviewedAt ?? reviewTime(createdAt, k)),
      path: `${student.id}/${randomUUID()}/evidence.png`,
      variant: variant++,
    });
  };
  const wasteItems = (): Item[] => {
    const ranges: Record<string, [number, number]> = {
      plastic: [300, 2500],
      paper: [500, 3000],
      metal_glass: [200, 1500],
      other: [100, 1000],
    };
    const codes = Object.keys(ranges).sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * 3));
    return codes.map((c) => ({ cat: cats[c], qty: Math.round(between(...ranges[c]) / 50) * 50 }));
  };

  // e1 fixed (about 3 months ago): most students, once each
  for (const s of students) {
    if (r() < 0.8) {
      joins.e1.push(s);
      if (r() < 0.9) add("e1", s, [], "approved", between(window("e1").start, window("e1").end));
    }
  }
  // e2 trees (about 2 months ago)
  for (const s of students) {
    if (r() < 0.65) {
      joins.e2.push(s);
      const n = r() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) add("e2", s, [{ qty: 1 + Math.floor(r() * 4) }], "approved", between(window("e2").start, window("e2").end));
    }
  }
  // e3 waste with weigh codes (last ~6 weeks)
  for (const s of students) {
    if (r() < 0.85) {
      joins.e3.push(s);
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) add("e3", s, wasteItems(), "approved", between(window("e3").start, window("e3").end));
    }
  }
  // e4 fixed, offsite (last week): 3 pending and 1 rejected for the review queue
  const e4 = students.filter(() => r() < 0.4);
  for (const s of students) if (e4.length < 8 && !e4.includes(s)) e4.push(s);
  e4.forEach((s, i) => {
    joins.e4.push(s);
    const outcome = i < 3 ? "pending" : i === 3 ? "rejected" : "approved";
    add("e4", s, [], outcome, between(window("e4").start, window("e4").end));
  });

  // the demo student: some approved history, enough points to redeem one reward live
  const d = (k: ActKey, frac: number) => window(k).start + (window(k).end - window(k).start) * frac;
  joins.e1.push(demo);
  add("e1", demo, [], "approved", d("e1", 0.3));
  joins.e2.push(demo);
  add("e2", demo, [{ qty: 3 }], "approved", d("e2", 0.5));
  joins.e3.push(demo);
  add("e3", demo, [{ cat: cats.plastic, qty: 2000 }, { cat: cats.paper, qty: 1500 }], "approved", d("e3", 0.4));
  add("e3", demo, [{ cat: cats.plastic, qty: 1500 }, { cat: cats.metal_glass, qty: 800 }], "approved", d("e3", 0.8));
  joins.e4.push(demo);
  add("e4", demo, [], "approved", d("e4", 0.5));

  // open activities: a few students joined; three results wait for review
  joins.o1.push(...students.slice(0, 6));
  joins.o2.push(...students.slice(6, 14));
  add("o1", students[0], [{ cat: cats.plastic, qty: 1200 }, { cat: cats.paper, qty: 900 }], "pending", now - 20 * HOUR);
  add("o2", students[6], [{ qty: 2 }], "pending", now - 10 * HOUR);
  add("o2", students[7], [{ qty: 1 }], "pending", now - 4 * HOUR);

  // I3: approved weigh results in the CURRENT Bangkok month (leaderboard "เดือนนี้", the demo student's rank card).
  // Window: from max(month start, o1 start) to 1 h ago; after a reset right after midnight on the 1st it shrinks
  // to the minutes since midnight, but stays inside this month.
  const o1Start = activityWindow(act("o1"), now).start;
  const lo = Math.max(bangkokMonthStart(now), o1Start) + MINUTE;
  const hi = Math.max(lo, now - HOUR);
  const inMonth = (frac: number) => {
    const created = Math.min(lo + (hi - lo) * frac, now - 2 * MINUTE);
    return { created, reviewed: Math.min(created + Math.max(MINUTE, (now - created) / 3), now - MINUTE) };
  };
  joins.o1.push(...students.slice(6, 14), demo);
  for (let i = 1; i < 14; i++) {
    const t = inMonth(r());
    add("o1", students[i], wasteItems(), "approved", t.created, t.reviewed);
  }
  const dm = inMonth(0.6);
  add("o1", demo, [{ cat: cats.plastic, qty: 1800 }, { cat: cats.paper, qty: 1200 }], "approved", dm.created, dm.reviewed);

  return { subs, joins };
}

async function uploadEvidence(ctx: Ctx, subs: Sub[]): Promise<void> {
  const queue = [...subs];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const { error } = await ctx.admin.storage
        .from("evidence")
        .upload(s.path, placeholderPng(s.variant), { contentType: "image/png", upsert: false });
      if (error) throw new Error(`evidence upload failed: ${error.message}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

const ts = (ms: number) => `'${new Date(ms).toISOString()}'::timestamptz`;

export async function insertSeed(ctx: Ctx): Promise<Record<string, number>> {
  const { db } = ctx;
  const { rows: catRows } = await db.query<{ id: string; code: string }>("select id, code from public.waste_categories");
  const cats = Object.fromEntries(catRows.map((c) => [c.code, c.id]));
  for (const code of ["plastic", "paper", "metal_glass", "other"]) {
    if (!cats[code]) throw new Error(`waste category ${code} is missing (migration 0003/0018)`);
  }

  const { students, demoStudent, teacher, adminUser } = await createUsers(ctx);
  const everyone = [...students, demoStudent, teacher, adminUser];
  const SEED = uuidArray(everyone.map((p) => p.id));
  const now = Date.now();
  const { subs, joins } = planSubmissions(students, demoStudent, cats, now);
  await uploadEvidence(ctx, subs);

  await db.query("begin");
  try {
    // roles and the demo flag (auth.uid() is null here: the 0002 trigger allows it)
    await db.query("update public.profiles set is_demo = true where id = any($1::uuid[])", [[demoStudent.id, teacher.id, adminUser.id]]);
    await db.query("update public.profiles set role = 'teacher' where id = $1", [teacher.id]);
    await db.query("update public.profiles set role = 'admin' where id = $1", [adminUser.id]);
    await db.query("update public.profiles set created_at = now() - interval '95 days' where id = any($1::uuid[])", [everyone.map((p) => p.id)]);

    // rewards and articles (staff content; written directly like the staff pages do)
    const rewardIds: Record<string, { id: string; cost: number }> = {};
    for (const rw of REWARDS) {
      const { rows } = await db.query<{ id: string }>(
        "insert into public.rewards (name, points_cost, stock, active, created_at) values ($1, $2, $3, true, now() - interval '80 days') returning id",
        [`${SEED_PREFIX}${rw.name}`, rw.cost, rw.stock],
      );
      rewardIds[rw.key] = { id: rows[0].id, cost: rw.cost };
    }
    for (const a of ARTICLES) {
      await db.query(
        `insert into public.articles (title, slug, body, published, author_id, created_at, updated_at)
         values ($1, $2, $3, $4, $5, now() - make_interval(days => $6), now() - make_interval(days => $6))`,
        [a.title, a.slug, a.body, a.published, teacher.id, a.daysAgo],
      );
    }

    // activities: all drafts first
    const actIds = {} as Record<ActKey, string>;
    for (const a of ACTIVITIES) {
      const ended = a.endsDaysAgo > 0;
      const { rows } = await db.query<{ id: string }>(
        `insert into public.activities
           (title, description, location, is_offsite, starts_at, ends_at, status, type, requires_code,
            unit_points, unit_carbon_kg, max_per_submission, created_by)
         values ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, null, $10, $11) returning id`,
        [
          a.title,
          a.description,
          a.location,
          a.offsite,
          // ended ones get a temporary window around now: join/submit check now() against it
          new Date(ended ? now - HOUR : activityWindow(a, now).start).toISOString(),
          new Date(ended ? now + DAY : activityWindow(a, now).end).toISOString(),
          a.type,
          a.requiresCode,
          a.unitPoints,
          a.maxPerSubmission,
          teacher.id,
        ],
      );
      actIds[a.key] = assertUuid(rows[0].id);
    }

    const counts = { joins: 0, codes: 0, submissions: 0, approved: 0, rejected: 0, pending: 0, orders: 0 };
    const join = async (k: ActKey) => {
      const a = ACTIVITIES.find((x) => x.key === k)!;
      for (const s of joins[k]) {
        await asUser(db, s.id, `select public.join_activity('${actIds[k]}')`);
        counts.joins++;
      }
      // joined shortly after the activity started (before any of their results)
      await db.query(
        `update public.participations set created_at = $2::timestamptz + (abs(hashtext(id::text)) % 36000) * interval '1 second'
         where activity_id = $1`,
        [actIds[k], new Date(activityWindow(a, now).start).toISOString()],
      );
    };
    const submit = async (s: Sub) => {
      const a = ACTIVITIES.find((x) => x.key === s.act)!;
      const actId = actIds[s.act];
      let code: string | null = null;
      if (a.requiresCode) {
        const rows = await asUser(db, teacher.id, `select code from public.issue_weigh_code('${actId}', '${s.student.id}')`);
        code = String(rows[0].code);
        counts.codes++;
      }
      const items = a.type === "fixed" ? [] : s.items.map((i) => (i.cat ? { waste_category_id: i.cat, quantity: i.qty } : { quantity: i.qty }));
      const rows = await asUser(
        db,
        s.student.id,
        `select public.submit_result('${actId}', ${lit(db, code)}, ${lit(db, JSON.stringify(items))}::jsonb, ${lit(db, s.path)}) as r`,
      );
      const res = rows[0].r as { ok: boolean; error_code: string | null; submission_id: string | null };
      if (!res.ok || !res.submission_id) throw new Error(`submit_result returned ${res.error_code}`);
      const id = assertUuid(res.submission_id);
      counts.submissions++;

      // as postgres, same round trip as the review: move the submission (and its code) back in time
      const C = ts(s.createdAt);
      const backdate = [
        `update public.submissions set created_at = ${C} where id = '${id}'`,
        `update public.submission_items set created_at = ${C} where submission_id = '${id}'`,
        `update public.weigh_codes w set created_at = ${C} - interval '10 minutes', expires_at = ${C} + interval '20 minutes', used_at = ${C}
           from public.submissions s where s.id = '${id}' and w.id = s.code_id`,
      ];
      if (s.outcome === "pending") {
        // staff keep the "new result" notification of results that still wait for review
        backdate.push(
          `update public.notifications set created_at = ${C} where type = 'submission_new' and link = '/staff/reviews/${id}' and user_id = any(${SEED})`,
        );
        await db.query(backdate.join(";\n"));
        counts.pending++;
        return;
      }
      const R = ts(s.reviewedAt!);
      backdate.push(
        `delete from public.notifications where type = 'submission_new' and link = '/staff/reviews/${id}' and user_id = any(${SEED})`,
        `update public.submissions set reviewed_at = ${R} where id = '${id}'`,
        `update public.ledger_entries set created_at = ${R} where ref_submission_id = '${id}' and kind = 'earn'`,
        // the one review notification just written for this student (older ones were already moved off now())
        `update public.notifications set created_at = ${R}, read_at = ${R} + interval '3 hours'
           where user_id = '${s.student.id}' and type in ('submission_approved', 'submission_rejected') and created_at = now()`,
      );
      const review =
        s.outcome === "approved"
          ? `select public.approve_submission('${id}')`
          : `select public.reject_submission('${id}', ${lit(db, REJECT_REASON)})`;
      await asUser(db, teacher.id, review, backdate.join(";\n"));
      counts[s.outcome]++;
    };

    // the ended activities: open (transiently), join, submit, review, then close at their real dates
    for (const k of ["e1", "e2", "e3", "e4"] as ActKey[]) {
      const a = ACTIVITIES.find((x) => x.key === k)!;
      await db.query("update public.activities set status = 'open' where id = $1", [actIds[k]]);
      await db.query("delete from public.notifications where type = 'activity_opened' and link = $1", [`/activities/${actIds[k]}`]);
      await join(k);
      for (const s of subs.filter((x) => x.act === k).sort((x, y) => x.createdAt - y.createdAt)) await submit(s);
      await db.query(
        `update public.activities set status = 'closed', starts_at = $2, ends_at = $3, created_at = $4 where id = $1`,
        [
          actIds[k],
          new Date(activityWindow(a, now).start).toISOString(),
          new Date(activityWindow(a, now).end).toISOString(),
          new Date(activityWindow(a, now).start - 5 * DAY).toISOString(),
        ],
      );
    }

    // orders through cart + checkout and the staff order functions
    const { rows: balances } = await db.query<{ id: string; points: number }>(
      `select l.student_id as id, sum(l.points)::int as points from public.ledger_entries l
       where l.student_id = any($1::uuid[]) group by l.student_id order by sum(l.points) desc, l.student_id`,
      [students.map((s) => s.id)],
    );
    const buyers = balances.map((b) => b.id);
    type OrderPlan = { buyer: string; lines: [string, number][]; state: "pending" | "ready" | "completed" | "cancelled"; created: number; ready?: number; done?: number };
    const orderPlans: OrderPlan[] = [
      { buyer: buyers[0], lines: [["pencil", 1], ["notebook", 1]], state: "pending", created: now - 20 * HOUR },
      { buyer: buyers[1], lines: [["bag", 1]], state: "ready", created: now - 2 * DAY, ready: now - DAY },
      { buyer: buyers[2], lines: [["straw", 1]], state: "completed", created: now - 20 * DAY, ready: now - 19 * DAY, done: now - 18 * DAY },
      { buyer: buyers[3], lines: [["seedling", 1]], state: "cancelled", created: now - 30 * DAY, done: now - 28 * DAY },
      { buyer: buyers[4], lines: [["pencil", 2]], state: "completed", created: now - 45 * DAY, ready: now - 44 * DAY, done: now - 43 * DAY },
      { buyer: demoStudent.id, lines: [["seedling", 1]], state: "completed", created: now - 10 * DAY, ready: now - 9 * DAY, done: now - 8 * DAY },
    ];
    for (const o of orderPlans) {
      for (const [key, qty] of o.lines) {
        await asUser(
          db,
          o.buyer,
          `insert into public.cart_items (student_id, reward_id, qty) values ('${assertUuid(o.buyer)}', '${rewardIds[key].id}', ${qty})`,
        );
      }
      const rows = await asUser(db, o.buyer, "select public.checkout() as r");
      const res = rows[0].r as { ok: boolean; error_code: string | null; order_id: string | null };
      if (!res.ok || !res.order_id) throw new Error(`checkout returned ${res.error_code}`);
      const id = assertUuid(res.order_id);
      counts.orders++;
      if (o.state === "ready" || o.state === "completed") await asUser(db, teacher.id, `select public.mark_order_ready('${id}')`);
      if (o.state === "completed") await asUser(db, teacher.id, `select public.complete_order('${id}')`);
      if (o.state === "cancelled") await asUser(db, teacher.id, `select public.cancel_order('${id}')`);

      const C = ts(o.created);
      const RD = o.ready ? ts(o.ready) : "null::timestamptz";
      const D = o.done ? ts(o.done) : "null::timestamptz";
      const closed = o.state === "completed" || o.state === "cancelled";
      await db.query(
        [
          `update public.orders set created_at = ${C}, expires_at = ${C} + interval '7 days', ready_at = case when ready_at is not null then ${RD} end,
             completed_at = case when completed_at is not null then ${D} end where id = '${id}'`,
          `update public.order_items set created_at = ${C} where order_id = '${id}'`,
          `update public.ledger_entries set created_at = case kind when 'redeem' then ${C} else ${D} end where ref_order_id = '${id}'`,
          `update public.notifications set
             created_at = case type when 'order_created' then ${C} when 'order_ready' then ${RD} else ${D} end,
             read_at = case when ${closed} or type = 'order_created' then
                         case type when 'order_created' then ${C} when 'order_ready' then ${RD} else ${D} end + interval '1 hour' end
           where link = '/orders/${id}' and user_id = '${o.buyer}'`,
          `update public.notifications set created_at = ${C}, read_at = case when ${o.state !== "pending"} then ${C} + interval '2 hours' end
           where type = 'order_new' and link = '/staff/orders?q=${id.slice(0, 8).toUpperCase()}' and user_id = any(${SEED})`,
        ].join(";\n"),
      );
    }

    // the open activities: opened once, here (one activity_opened per student), then a few joins and results
    for (const k of ["o1", "o2"] as ActKey[]) {
      const a = ACTIVITIES.find((x) => x.key === k)!;
      await db.query("update public.activities set status = 'open', created_at = $2 where id = $1", [
        actIds[k],
        new Date(activityWindow(a, now).start - 2 * DAY).toISOString(),
      ]);
      await join(k);
      for (const s of subs.filter((x) => x.act === k).sort((x, y) => x.createdAt - y.createdAt)) await submit(s);
    }

    // nothing for users outside the seed domain: only rows written by this transaction carry now()
    const { rowCount: foreign } = await db.query(
      `delete from public.notifications where created_at = now() and not (user_id = any(${SEED}))
         and type in ('activity_opened', 'submission_new', 'order_new')`,
    );
    // the remaining activity_opened rows of seed students date from the opening
    await db.query(
      `update public.notifications n set created_at = a.starts_at from public.activities a
       where n.type = 'activity_opened' and n.link = '/activities/' || a.id::text and a.id = any($1::uuid[])`,
      [[actIds.o1, actIds.o2]],
    );
    await db.query("commit");
    return { ...counts, "seed users": everyone.length, "evidence files": subs.length, "notifications removed for non-seed users": foreign ?? 0 };
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  }
}
