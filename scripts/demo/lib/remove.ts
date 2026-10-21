import { SEED_EMAIL_SUFFIX, SEED_PREFIX, SEED_SLUG_PREFIX, type Ctx } from "./context.ts";
import { objectsInFolders, removeObjects } from "./db.ts";

// Removal of everything the seed created (R138). Used by seed.ts (seed = remove previous seed + insert)
// and reset-demo.ts. It never deletes or edits a row of a user outside the seed domain; if such a user
// has data hanging off seed content (joined a seed activity, ordered a seed reward, ...) it refuses
// before changing anything and asks for demo:purge first.
//
// What counts as seed data:
//   users       auth.users with an e-mail under @seed.greencampus.example (the 3 demo accounts + 30 students)
//   activities  title starts with "[ตัวอย่าง] ", or created_by is a seed user (e.g. one the demo teacher made live)
//   rewards     name starts with "[ตัวอย่าง] " (rewards have no created_by column)
//   articles    slug starts with "seed-", or author_id is a seed user
//
// Foreign keys (checked against pg_constraint, see the report) and the explicit order used here, in one
// transaction, so no FK RESTRICT / trigger ever fires and nothing depends on a cascade by accident:
//   1. release_orders(pending orders of seed users, 'cancelled')  stock back + refund rows (the R93 trigger
//      would put stock back on the profile delete anyway; done explicitly per the carry)
//   2. notifications        of seed users                                (user_id -> profiles CASCADE)
//   3. cart_items           of seed users or on seed rewards             (both FKs CASCADE)
//   4. ledger_entries       of seed users                                (student_id CASCADE; refs SET NULL)
//   5. order_items, orders  of seed users                                (order_items.reward_id RESTRICT: must go
//                                                                         before the rewards)
//   6. submission_items, submissions  of seed users or on seed activities (submissions.activity_id RESTRICT +
//                                                                         activities_prevent_delete_with_submissions)
//   7. weigh_codes, participations    of seed users or on seed activities (activity FKs CASCADE)
//   8. activities, rewards, articles  (seed ones)                        (nothing references them any more)
// After the commit, through the APIs:
//   9. Storage: evidence/<seed user id>/..., reward-images of seed rewards, article-images/<seed article id>/...
//  10. Auth admin deleteUser for each seed user (profiles row cascades; set-null columns on other users'
//      rows that a demo account acted on: submissions.reviewed_by, ledger_entries.created_by,
//      weigh_codes.issued_by, orders.completed_by, activities.created_by, articles.author_id).

export type RemovalCounts = Record<string, number>;

export class RealUserDataError extends Error {}

export async function removeSeedData(ctx: Ctx): Promise<RemovalCounts> {
  const { db, admin } = ctx;
  const counts: RemovalCounts = {};
  let userIds: string[] = [];
  let rewardImages: string[] = [];
  let articleIds: string[] = [];
  let evidence: string[] = [];
  let articleImages: string[] = [];

  await db.query("begin");
  try {
    const users = await db.query<{ id: string }>("select id from auth.users where lower(email) like $1", [`%${SEED_EMAIL_SUFFIX}`]);
    userIds = users.rows.map((r) => r.id);
    const activities = await db.query<{ id: string }>(
      "select id from public.activities where starts_with(title, $1) or created_by = any($2::uuid[]) for update",
      [SEED_PREFIX, userIds],
    );
    const activityIds = activities.rows.map((r) => r.id);
    const rewards = await db.query<{ id: string; image_path: string | null }>(
      "select id, image_path from public.rewards where starts_with(name, $1) for update",
      [SEED_PREFIX],
    );
    const rewardIds = rewards.rows.map((r) => r.id);
    rewardImages = rewards.rows.map((r) => r.image_path).filter((p): p is string => !!p);
    const articles = await db.query<{ id: string }>(
      "select id from public.articles where starts_with(slug, $1) or author_id = any($2::uuid[]) for update",
      [SEED_SLUG_PREFIX, userIds],
    );
    articleIds = articles.rows.map((r) => r.id);
    // every storage path is collected now, before the rows that point at them are deleted (fix round 1)
    evidence = await objectsInFolders(db, "evidence", userIds);
    articleImages = await objectsInFolders(db, "article-images", articleIds);

    // Refuse if a user outside the seed domain has rows on seed content (we would have to delete them).
    const { rows: blocked } = await db.query<{ n: number }>(
      `select count(distinct uid)::int as n from (
         select student_id as uid from public.participations where activity_id = any($1::uuid[])
         union all select student_id from public.weigh_codes where activity_id = any($1::uuid[])
         union all select student_id from public.submissions where activity_id = any($1::uuid[])
         union all select o.student_id from public.order_items oi join public.orders o on o.id = oi.order_id
                   where oi.reward_id = any($2::uuid[])
         union all select student_id from public.cart_items where reward_id = any($2::uuid[])
       ) t where not (uid = any($3::uuid[]))`,
      [activityIds, rewardIds, userIds],
    );
    if (blocked[0].n > 0) {
      throw new RealUserDataError(
        `ไม่รีเซ็ต: มีผู้ใช้จริง ${blocked[0].n} คน (นอกโดเมน seed) ที่มีข้อมูลผูกกับกิจกรรม/ของรางวัลตัวอย่าง ` +
          "ให้รัน npm run demo:purge ก่อน (ลบผู้ใช้ที่ไม่ใช่ admin จริง) แล้วค่อยรีเซ็ต ไม่มีอะไรถูกเปลี่ยน\n" +
          `Refusing to reset: ${blocked[0].n} real (non-seed) user(s) have data on seed activities/rewards. ` +
          "Run npm run demo:purge first, then demo:reset. Nothing was changed.",
      );
    }

    const exec = async (key: string, sql: string, params: unknown[]) => {
      const r = await db.query(sql, params);
      counts[key] = (counts[key] ?? 0) + (r.rowCount ?? 0);
    };
    const pending = await db.query<{ n: number }>(
      `select coalesce(public.release_orders(array_agg(o.id order by o.id), 'cancelled', null), 0)::int as n
       from public.orders o where o.student_id = any($1::uuid[]) and o.status = 'pending_pickup'`,
      [userIds],
    );
    counts["pending orders released"] = pending.rows[0].n;
    await exec("notifications", "delete from public.notifications where user_id = any($1::uuid[])", [userIds]);
    await exec("cart_items", "delete from public.cart_items where student_id = any($1::uuid[]) or reward_id = any($2::uuid[])", [userIds, rewardIds]);
    await exec("ledger_entries", "delete from public.ledger_entries where student_id = any($1::uuid[])", [userIds]);
    await exec(
      "order_items",
      "delete from public.order_items where order_id in (select id from public.orders where student_id = any($1::uuid[]))",
      [userIds],
    );
    await exec("orders", "delete from public.orders where student_id = any($1::uuid[])", [userIds]);
    const subWhere = "student_id = any($1::uuid[]) or activity_id = any($2::uuid[])";
    await exec(
      "submission_items",
      `delete from public.submission_items where submission_id in (select id from public.submissions where ${subWhere})`,
      [userIds, activityIds],
    );
    await exec("submissions", `delete from public.submissions where ${subWhere}`, [userIds, activityIds]);
    await exec("weigh_codes", `delete from public.weigh_codes where ${subWhere}`, [userIds, activityIds]);
    await exec("participations", `delete from public.participations where ${subWhere}`, [userIds, activityIds]);
    await exec("activities", "delete from public.activities where id = any($1::uuid[])", [activityIds]);
    await exec("rewards", "delete from public.rewards where id = any($1::uuid[])", [rewardIds]);
    await exec("articles", "delete from public.articles where id = any($1::uuid[])", [articleIds]);
    await db.query("commit");
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  }

  // Storage (API only), then the auth users. The paths were collected before the commit. If a removal fails
  // here: evidence lives in the seed users' folders and those users still exist, so a rerun recomputes and
  // removes it; reward-images / article-images objects whose rows are gone are no longer referenced, so the
  // daily orphan cleanup (Task 19, > 24 h) removes them. The failure message gives the counts.
  const plan = { evidence: evidence.length, "reward-images": rewardImages.length, "article-images": articleImages.length };
  try {
    counts["storage evidence"] = await removeObjects(admin, "evidence", evidence);
    counts["storage reward-images"] = await removeObjects(admin, "reward-images", rewardImages);
    counts["storage article-images"] = await removeObjects(admin, "article-images", articleImages);
  } catch (e) {
    throw new Error(
      `${(e as Error).message}; files to remove were ${JSON.stringify(plan)}: rerun demo:reset for evidence; ` +
        "unreferenced reward/article images are removed by the daily orphan cleanup",
    );
  }
  let deleted = 0;
  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`auth deleteUser failed: ${error.message}`);
    deleted++;
  }
  counts["seed users"] = deleted;
  return counts;
}
