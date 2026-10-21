import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { PNG_1X1 } from "./helpers/images";
import {
  createConfirmedUser,
  createJoinedCodeActivity,
  deleteActivitiesByTitle,
  deleteUsers,
  localEnv,
  seedSubmission,
  storageObjectExists,
  type TestUser,
} from "./helpers/supabase-admin";

// Task 19 (R132): the orphan cleanup route against the LOCAL stack. Uploads four objects with unique
// prefixes, backdates three by 25h (test setup only: a metadata update of storage.objects.created_at),
// then calls the real route: ?dry=1 deletes nothing, the real call removes only the two old orphans.
// CRON_SECRET comes from playwright.config (fixed test value outside CI). Asserts only on its own objects.
// Database + HTTP only: chromium project only.

const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SECRET = process.env.CRON_SECRET || "e2e-cron-secret";
const ROUTE = "/api/cron/cleanup-orphans";

test("orphan cleanup removes only old unreferenced images", async ({ request }, info) => {
  test.skip(info.project.name !== "chromium", "database + HTTP only");
  const host = new URL(DB_URL).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`refusing non-local database (${host})`);

  const { url, secretKey } = localEnv();
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = randomUUID().slice(0, 8);
  const title = `กิจกรรมล้างรูป ${suffix}`;
  const prefix = `e2e-orphan-${suffix}`;
  const auth = { Authorization: `Bearer ${SECRET}` };
  let student: TestUser | undefined;
  const uploaded: { bucket: string; path: string }[] = [];

  async function put(bucket: string, path: string): Promise<void> {
    const { error } = await admin.storage.from(bucket).upload(path, PNG_1X1, { contentType: "image/png" });
    if (error) throw new Error(`upload ${bucket} failed: ${error.message}`);
    uploaded.push({ bucket, path });
  }

  const db = new pg.Client({ connectionString: DB_URL });
  try {
    student = await createConfirmedUser("student", `student-orphan-${suffix}`);
    const activityId = await createJoinedCodeActivity(title, student.id, { requires_code: false });
    const referencedSubmission = await seedSubmission(student, activityId, PNG_1X1);
    const { data: sub } = await admin.from("submissions").select("evidence_path").eq("id", referencedSubmission).single();
    const referenced = (sub as { evidence_path: string }).evidence_path;
    uploaded.push({ bucket: "evidence", path: referenced });

    const oldEvidence = `${prefix}/a/old-evidence.png`;
    const oldReward = `${prefix}/old-reward.png`;
    const fresh = `${prefix}/b/fresh.png`;
    await put("evidence", oldEvidence);
    await put("reward-images", oldReward);
    await put("evidence", fresh);

    await db.connect();
    const res = await db.query(
      `update storage.objects set created_at = now() - interval '25 hours'
       where (bucket_id = 'evidence' and name = any($1)) or (bucket_id = 'reward-images' and name = $2)`,
      [[oldEvidence, referenced], oldReward],
    );
    expect(res.rowCount).toBe(3);

    // No auth: 401 and nothing deleted.
    expect((await request.get(ROUTE)).status()).toBe(401);
    expect((await request.get(ROUTE, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);

    // Dry run: counts include the orphans, nothing is deleted.
    const dryRes = await request.get(`${ROUTE}?dry=1`, { headers: auth });
    expect(dryRes.status(), "is the dev server running with CRON_SECRET? see playwright.config.ts").toBe(200);
    expect(dryRes.headers()["cache-control"]).toBe("no-store");
    const dry = await dryRes.json();
    expect(dry.dryRun).toBe(true);
    expect(dry.byBucket.evidence).toBeGreaterThanOrEqual(1);
    expect(dry.byBucket["reward-images"]).toBeGreaterThanOrEqual(1);
    expect(dry.deleted).toBeGreaterThanOrEqual(2);
    expect(await storageObjectExists("evidence", oldEvidence)).toBe(true);
    expect(await storageObjectExists("reward-images", oldReward)).toBe(true);

    // Real run.
    const realRes = await request.get(ROUTE, { headers: auth });
    expect(realRes.status()).toBe(200);
    const real = await realRes.json();
    expect(real.dryRun).toBe(false);
    expect(real.deleted).toBeGreaterThanOrEqual(2);
    expect(await storageObjectExists("evidence", oldEvidence)).toBe(false);
    expect(await storageObjectExists("reward-images", oldReward)).toBe(false);
    expect(await storageObjectExists("evidence", referenced)).toBe(true);
    expect(await storageObjectExists("evidence", fresh)).toBe(true);
  } finally {
    await db.end().catch(() => {});
    for (const o of uploaded) await admin.storage.from(o.bucket).remove([o.path]);
    await deleteActivitiesByTitle(title);
    await deleteUsers([student]);
  }
});
