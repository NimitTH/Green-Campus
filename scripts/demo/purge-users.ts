// Purge users before the demo day (spec 13.2 mode 2; ruling R138): delete EVERY auth user except the real
// admins (role admin, is_demo false), with their evidence pictures. Dry run by default (counts only);
// `--yes` deletes.
//   CONFIRM_PROJECT_REF=<ref> DATABASE_URL=... npm run demo:purge            (dry run)
//   CONFIRM_PROJECT_REF=<ref> DATABASE_URL=... npm run demo:purge -- --yes   (delete)
// Afterwards run demo:reset to recreate the demo accounts and data (docs/demo-checklist.md).
//
// Users whose role a demo admin changed (carry from Task 18): after the purge only real admins remain, and a
// demo admin can never change a real admin (set_user_role, 0019/0021), so nobody is left with a role a demo
// account gave them.
//
// Order: (1) one transaction releases the pending orders of the users to delete (release_orders: stock back,
// refund; the R93 profile-delete trigger would restore stock too), (2) Storage API removes their evidence
// folders, (3) Auth admin deleteUser per user: profiles cascade (participations, weigh_codes, submissions
// + items, orders + items, cart, ledger, notifications); set-null columns elsewhere (activities.created_by,
// articles.author_id, reviewed_by, issued_by, completed_by, ledger created_by). Seed activities, rewards and
// articles stay (now without an author) until demo:reset removes them by their prefix.
import { openContext, runScript, type Ctx } from "./lib/context.ts";
import { objectsInFolders, removeObjects } from "./lib/db.ts";

const ref: { ctx?: Ctx } = {};
await runScript(async () => {
  const yes = process.argv.slice(2).includes("--yes");
  const ctx = (ref.ctx = await openContext({ needDemoPassword: false }));
  const { db, admin } = ctx;
  ctx.log(`demo:purge -> project "${ctx.ref}" (${yes ? "--yes: ลบจริง / deleting" : "dry run: ไม่ลบ แสดงจำนวนเท่านั้น / counts only"})`);

  const { rows: keep } = await db.query<{ n: number }>(
    "select count(*)::int as n from auth.users u join public.profiles p on p.id = u.id where p.role = 'admin' and not p.is_demo",
  );
  if (keep[0].n === 0) {
    throw new Error(
      "ไม่ลบ: ไม่พบ admin จริง (role admin, is_demo false) ถ้าลบจะไม่เหลือผู้ดูแล / refusing: no real admin exists, the purge would leave none. Nothing was changed.",
    );
  }
  const { rows: targets } = await db.query<{ id: string; role: string | null; is_demo: boolean | null }>(
    `select u.id, p.role, p.is_demo from auth.users u left join public.profiles p on p.id = u.id
     where not (p.role is not distinct from 'admin' and p.is_demo is not distinct from false)`,
  );
  const ids = targets.map((t) => t.id);
  const byRole: Record<string, number> = {};
  for (const t of targets) {
    const k = `${t.role ?? "no profile"}${t.is_demo ? " (demo)" : ""}`;
    byRole[k] = (byRole[k] ?? 0) + 1;
  }
  const { rows: pending } = await db.query<{ n: number }>(
    "select count(*)::int as n from public.orders where student_id = any($1::uuid[]) and status = 'pending_pickup'",
    [ids],
  );
  const evidence = await objectsInFolders(db, "evidence", ids);
  ctx.log(`เก็บไว้ (admin จริง) / kept real admins: ${keep[0].n}`);
  ctx.log(`จะลบ / users to delete: ${ids.length} ${JSON.stringify(byRole)}`);
  ctx.log(`ออเดอร์ค้างที่จะคืนสต็อก / pending orders to release: ${pending[0].n}; รูปหลักฐาน / evidence files: ${evidence.length}`);
  if (!yes) {
    ctx.log("dry run: ไม่มีอะไรถูกลบ เพิ่ม --yes เพื่อลบจริง / nothing deleted; add --yes to delete");
    return;
  }

  await db.query("begin");
  try {
    const { rows } = await db.query<{ n: number }>(
      `select coalesce(public.release_orders(array_agg(o.id order by o.id), 'cancelled', null), 0)::int as n
       from public.orders o where o.student_id = any($1::uuid[]) and o.status = 'pending_pickup'`,
      [ids],
    );
    await db.query("commit");
    ctx.log(`คืนสต็อกออเดอร์ค้าง / released pending orders: ${rows[0].n}`);
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  }
  const removed = await removeObjects(admin, "evidence", evidence);
  let deleted = 0;
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`auth deleteUser failed after ${deleted} users: ${error.message}`);
    deleted++;
  }
  ctx.log(`ลบแล้ว / deleted users: ${deleted}; evidence files: ${removed}`);
  ctx.log("ต่อไป: npm run demo:reset เพื่อสร้างบัญชีและข้อมูลสาธิตใหม่ / next: npm run demo:reset");
}, ref);
