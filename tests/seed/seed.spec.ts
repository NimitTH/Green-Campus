import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { signIn } from "../e2e/helpers/auth";
import { createConfirmedUser, deleteUsers, localEnv, type TestUser } from "../e2e/helpers/supabase-admin";

// Task 20 (R139): the demo scripts in scripts/demo, run as real child processes against the LOCAL stack only.
// Not part of test:e2e: these tests seed, reset and PURGE the local database (every user except real
// admins is deleted). Run with `npm run test:seed`. The last test leaves a freshly seeded database behind,
// so `npx supabase test db` can be run against seed data afterwards.

test.skip(
  process.env.npm_lifecycle_event !== "test:seed" && process.env.RUN_SEED_TESTS !== "1",
  "seed tests purge the local database; run them with `npm run test:seed`",
);
test.describe.configure({ mode: "serial" });

const ROOT = process.cwd();
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
// Test-only value (never a real password): the scripts require >= 12 characters.
const TEST_DEMO_PASSWORD = "seed-test-Demo-pass-2026";
const SEED_DOMAIN = "@seed.greencampus.example";
const DEMO = {
  student: `demo-student${SEED_DOMAIN}`,
  teacher: `demo-teacher${SEED_DOMAIN}`,
  admin: `demo-admin${SEED_DOMAIN}`,
};

type Run = { status: number | null; stdout: string; stderr: string };

function run(script: "seed" | "reset-demo" | "purge-users", args: string[] = [], env: Record<string, string | undefined> = {}): Run {
  localEnv(); // loads .env.local into process.env and refuses a non-local URL before anything runs
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    CONFIRM_PROJECT_REF: "local",
    DATABASE_URL: LOCAL_DB,
    DEMO_PASSWORD: TEST_DEMO_PASSWORD,
    ...env,
  };
  for (const k of Object.keys(childEnv)) if (childEnv[k] === undefined) delete childEnv[k];
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "demo", `${script}.ts`), ...args], {
    cwd: ROOT,
    env: childEnv as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 240_000,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

async function withDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: LOCAL_DB });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

const COUNTED = [
  "auth.users",
  "public.profiles",
  "public.activities",
  "public.participations",
  "public.weigh_codes",
  "public.submissions",
  "public.submission_items",
  "public.ledger_entries",
  "public.rewards",
  "public.cart_items",
  "public.orders",
  "public.order_items",
  "public.notifications",
  "public.articles",
];

/** Row count of every table the seed touches, plus the evidence objects in storage. */
async function counts(): Promise<Record<string, number>> {
  return withDb(async (c) => {
    const out: Record<string, number> = {};
    for (const t of COUNTED) {
      const { rows } = await c.query<{ n: number }>(`select count(*)::int as n from ${t}`);
      out[t] = rows[0].n;
    }
    const { rows } = await c.query<{ n: number }>("select count(*)::int as n from storage.objects where bucket_id = 'evidence'");
    out["storage.objects(evidence)"] = rows[0].n;
    return out;
  });
}

async function role(userId: string): Promise<{ role: string; is_demo: boolean } | null> {
  return withDb(async (c) => {
    const { rows } = await c.query<{ role: string; is_demo: boolean }>("select role, is_demo from public.profiles where id = $1", [userId]);
    return rows[0] ?? null;
  });
}

let realAdmin: TestUser | undefined;
let realStudent: TestUser | undefined;
let afterSeed: Record<string, number> | undefined;

test.beforeAll(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  realAdmin = await createConfirmedUser("admin", `seed-real-admin-${suffix}`);
  realStudent = await createConfirmedUser("student", `seed-real-student-${suffix}`);
});

test.afterAll(async () => {
  await deleteUsers([realStudent, realAdmin]);
});

test("guard: ref derivation from the Supabase URL and DATABASE_URL", async () => {
  const { projectRefFromUrl, projectRefFromDbUrl } = (await import(
    pathToFileURL(path.join(ROOT, "scripts", "demo", "lib", "guard.ts")).href
  )) as typeof import("../../scripts/demo/lib/guard");
  expect(projectRefFromUrl("http://127.0.0.1:54321")).toBe("local");
  expect(projectRefFromUrl("http://localhost:54321")).toBe("local");
  expect(projectRefFromUrl("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
  expect(projectRefFromUrl("https://example.com")).toBeNull();
  expect(projectRefFromUrl("not a url")).toBeNull();
  expect(projectRefFromDbUrl(LOCAL_DB)).toBe("local");
  expect(projectRefFromDbUrl("postgresql://postgres.abcdefghijklmnop:x@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres")).toBe("abcdefghijklmnop");
  expect(projectRefFromDbUrl("postgresql://postgres:x@db.abcdefghijklmnop.supabase.co:5432/postgres")).toBe("abcdefghijklmnop");
  expect(projectRefFromDbUrl("postgresql://postgres:x@some-other-host:5432/postgres")).toBeNull();
});

test("guard (R141): DATABASE_URL query parameters cannot redirect the target; pg gets the checked fields", async () => {
  const guard = (await import(pathToFileURL(path.join(ROOT, "scripts", "demo", "lib", "guard.ts")).href)) as typeof import("../../scripts/demo/lib/guard");
  const { projectRefFromDbUrl, parseDbUrl, checkTarget } = guard;
  const LOCAL = "postgresql://postgres:pw@127.0.0.1:54322/postgres";
  // pg-connection-string lets ?host= / ?user= / ?hostaddr= ... override the URL parts: all refused
  for (const q of [
    "?host=aws-0-x.pooler.supabase.com&user=postgres.realref",
    "?host=aws-0-x.pooler.supabase.com",
    "?user=postgres.realref",
    "?hostaddr=10.0.0.1",
    "?port=6543",
    "?options=-c%20search_path%3Dx",
    "?service=prod",
    "?application_name=x",
    "?sslrootcert=/tmp/ca.pem",
    "?sslmode=require&host=evil",
  ]) {
    expect(projectRefFromDbUrl(LOCAL + q), q).toBeNull();
    const parsed = parseDbUrl(LOCAL + q);
    expect(parsed.ok, q).toBe(false);
    const target = checkTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", DATABASE_URL: LOCAL + q, CONFIRM_PROJECT_REF: "local" });
    expect(target.ok, q).toBe(false);
  }
  // other schemes, a missing host, several hosts, a socket path: refused
  for (const bad of [
    "mysql://postgres:pw@127.0.0.1:3306/postgres",
    "postgresql:///postgres",
    "postgresql://postgres:pw@/postgres",
    "postgresql://postgres:pw@127.0.0.1,aws-0-x.pooler.supabase.com/postgres",
    "postgresql://postgres:pw@%2Fvar%2Frun%2Fpostgresql/postgres",
    "postgresql://postgres:pw@127.0.0.1:54322/",
  ]) {
    expect(parseDbUrl(bad).ok, bad).toBe(false);
    expect(projectRefFromDbUrl(bad), bad).toBeNull();
  }
  // sslmode is the only allowed parameter
  const withSsl = parseDbUrl("postgresql://postgres.abcdefghijklmnop:p%40ss@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require");
  expect(withSsl).toEqual({
    ok: true,
    ref: "abcdefghijklmnop",
    config: {
      host: "aws-0-ap-southeast-1.pooler.supabase.com",
      port: 5432,
      user: "postgres.abcdefghijklmnop",
      password: "p@ss",
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    },
  });
  expect(parseDbUrl("postgresql://postgres:pw@127.0.0.1:54322/postgres?sslmode=bogus").ok).toBe(false);
  // the config pg receives is built from exactly the fields that were checked
  const local = checkTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", DATABASE_URL: LOCAL, CONFIRM_PROJECT_REF: "local" });
  expect(local).toEqual({
    ok: true,
    ref: "local",
    db: { host: "127.0.0.1", port: 54322, user: "postgres", password: "pw", database: "postgres", ssl: false },
  });
});

test("a wrong CONFIRM_PROJECT_REF (or a bad DEMO_PASSWORD) exits non-zero and changes nothing", async () => {
  const before = await counts();
  for (const [script, args] of [["seed", []], ["reset-demo", []], ["purge-users", ["--yes"]]] as const) {
    for (const ref of ["wrong-ref", "", undefined]) {
      const r = run(script, [...args], { CONFIRM_PROJECT_REF: ref });
      expect(r.status, `${script} ref=${ref}`).not.toBe(0);
      expect(r.stderr, `${script} ref=${ref}`).toContain("CONFIRM_PROJECT_REF");
    }
    // DATABASE_URL of another project than the API URL
    const mismatch = run(script, [...args], {
      DATABASE_URL: "postgresql://postgres.abcdefghijklmnop:x@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    });
    expect(mismatch.status, `${script} db mismatch`).not.toBe(0);
    // R141: a local-looking URL whose ?host= would send pg elsewhere
    const redirected = run(script, [...args], { DATABASE_URL: `${LOCAL_DB}?host=aws-0-x.pooler.supabase.com&user=postgres.realref` });
    expect(redirected.status, `${script} ?host bypass`).not.toBe(0);
    expect(redirected.stderr, `${script} ?host bypass`).toContain("DATABASE_URL");
  }
  for (const pw of [undefined, "short-pass"]) {
    for (const script of ["seed", "reset-demo"] as const) {
      const r = run(script, [], { DEMO_PASSWORD: pw });
      expect(r.status, `${script} pw=${pw === undefined ? "missing" : "short"}`).not.toBe(0);
      expect(r.stderr).toContain("DEMO_PASSWORD");
      expect(r.stdout + r.stderr).not.toContain(TEST_DEMO_PASSWORD);
    }
  }
  expect(await counts()).toEqual(before);
});

test("seed run twice gives the same row count in every table it touches", async () => {
  const first = run("seed");
  expect(first.status, first.stderr).toBe(0);
  const c1 = await counts();
  const second = run("seed");
  expect(second.status, second.stderr).toBe(0);
  const c2 = await counts();
  expect(c2).toEqual(c1);
  afterSeed = c2;
  // never print the demo password or secrets
  for (const out of [first, second]) {
    expect(out.stdout + out.stderr).not.toContain(TEST_DEMO_PASSWORD);
    expect(out.stdout + out.stderr).not.toContain(process.env.SUPABASE_SECRET_KEY ?? "<no key>");
  }

  // the content R137 asks for
  await withDb(async (c) => {
    const one = async (sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows[0] as Record<string, number>;
    expect((await one(`select count(*)::int n from auth.users where email like $1`, [`%${SEED_DOMAIN}`])).n).toBe(33);
    const acts = (await c.query(`select type, status, requires_code, ends_at > now() as future from public.activities where title like '[ตัวอย่าง] %'`)).rows;
    expect(acts).toHaveLength(6);
    for (const t of ["waste", "trees", "fixed"]) expect(acts.filter((a) => a.type === t)).toHaveLength(2);
    expect(acts.filter((a) => a.status === "closed" && !a.future)).toHaveLength(4);
    const open = acts.filter((a) => a.status === "open" && a.future);
    expect(open.map((a) => `${a.type}:${a.requires_code}`).sort()).toEqual(["trees:false", "waste:true"]);
    expect((await one(`select count(*)::int n from public.rewards where name like '[ตัวอย่าง] %'`)).n).toBe(8);
    expect((await one(`select count(*)::int n from public.articles where slug like 'seed-%' and published`)).n).toBe(3);
    expect((await one(`select count(*)::int n from public.articles where slug like 'seed-%' and not published`)).n).toBe(1);
    const subs = await one(`select count(*) filter (where status = 'approved')::int approved,
                                   count(*) filter (where status = 'pending')::int pending,
                                   count(*) filter (where status = 'rejected')::int rejected,
                                   extract(day from now() - min(reviewed_at))::int oldest_days,
                                   extract(day from now() - max(reviewed_at) filter (where status = 'approved'))::int newest_days
                            from public.submissions`);
    expect(subs.approved).toBeGreaterThan(40);
    expect(subs.pending).toBeGreaterThanOrEqual(2);
    expect(subs.rejected).toBe(1);
    expect(subs.oldest_days).toBeGreaterThanOrEqual(60); // spread over about 3 months
    expect(subs.newest_days).toBeLessThanOrEqual(3);
    const orders = (await c.query(`select status, ready_at is not null as ready from public.orders`)).rows;
    expect(orders.some((o) => o.status === "pending_pickup" && !o.ready)).toBe(true);
    expect(orders.some((o) => o.status === "pending_pickup" && o.ready)).toBe(true);
    expect(orders.some((o) => o.status === "completed")).toBe(true);
    expect(orders.some((o) => o.status === "cancelled")).toBe(true);
    // the seed leaves nothing for users outside the seed domain
    expect((await one(`select count(*)::int n from public.notifications n join auth.users u on u.id = n.user_id where u.email not like $1`, [`%${SEED_DOMAIN}`])).n).toBe(0);
  });
});

test("seed full names come from scripts/demo/lib/names.ts", async () => {
  const names = (await import(pathToFileURL(path.join(ROOT, "scripts", "demo", "lib", "names.ts")).href)) as typeof import("../../scripts/demo/lib/names");
  const allowed = new Set<string>([...names.SEED_STUDENT_NAMES, ...Object.values(names.DEMO_NAMES)]);
  expect(names.SEED_STUDENT_NAMES).toHaveLength(30);
  expect(new Set(names.SEED_STUDENT_NAMES).size).toBe(30);
  const rows = await withDb(async (c) =>
    (await c.query<{ full_name: string; display_name: string | null }>(
      `select p.full_name, p.display_name from public.profiles p join auth.users u on u.id = p.id where u.email like $1`,
      [`%${SEED_DOMAIN}`],
    )).rows,
  );
  expect(rows).toHaveLength(33);
  for (const r of rows) {
    expect(allowed.has(r.full_name), r.full_name).toBe(true);
  }
});

test("the three demo accounts: is_demo, roles, confirmed e-mail, sign in with DEMO_PASSWORD", async () => {
  const rows = await withDb(async (c) =>
    (await c.query<{ email: string; role: string; is_demo: boolean; confirmed: boolean; id: string }>(
      `select u.email, p.role, p.is_demo, u.email_confirmed_at is not null as confirmed, u.id
       from auth.users u join public.profiles p on p.id = u.id where u.email = any($1) order by u.email`,
      [Object.values(DEMO)],
    )).rows,
  );
  expect(rows.map((r) => [r.email, r.role, r.is_demo, r.confirmed])).toEqual([
    [DEMO.admin, "admin", true, true],
    [DEMO.student, "student", true, true],
    [DEMO.teacher, "teacher", true, true],
  ]);
  // other seed users are not demo accounts
  const nonDemo = await withDb(async (c) =>
    (await c.query(`select count(*)::int n from public.profiles p join auth.users u on u.id = p.id where u.email like $1 and p.is_demo`, [`%${SEED_DOMAIN}`])).rows[0].n,
  );
  expect(nonDemo).toBe(3);

  const { url, publishableKey } = localEnv();
  for (const email of Object.values(DEMO)) {
    const c = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: TEST_DEMO_PASSWORD });
    expect(error, email).toBeNull();
  }

  // the demo student can redeem at least one seed reward live
  const ok = await withDb(async (c) =>
    (await c.query(
      `select exists (
         select 1 from public.rewards r
         where r.name like '[ตัวอย่าง] %' and r.active and r.stock > 0
           and r.points_cost <= (select coalesce(sum(l.points), 0) from public.ledger_entries l where l.student_id = $1)
       ) as ok`,
      [rows.find((r) => r.email === DEMO.student)!.id],
    )).rows[0].ok,
  );
  expect(ok).toBe(true);
});

test("the demo teacher downloads the summary PDF for the seeded range", async ({ page }) => {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
  const to = fmt(new Date());
  const from = fmt(new Date(Date.now() - 100 * 24 * 60 * 60_000));
  await signIn(page, { id: "", email: DEMO.teacher, password: TEST_DEMO_PASSWORD, role: "teacher" }, "/staff/reports");
  const res = await page.request.get(`/api/reports/pdf?from=${from}&to=${to}`);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 4).toString("latin1")).toBe("%PDF");
});

test("reset-demo keeps real users (role included) and gives the same counts as a fresh seed", async () => {
  const r = run("reset-demo");
  expect(r.status, r.stderr).toBe(0);
  expect(await role(realAdmin!.id)).toEqual({ role: "admin", is_demo: false });
  expect(await role(realStudent!.id)).toEqual({ role: "student", is_demo: false });
  expect(await counts()).toEqual(afterSeed);
  expect(r.stdout + r.stderr).not.toContain(realAdmin!.email);
});

test("reset-demo refuses while a real user has data on seed content, and changes nothing", async () => {
  const activityId = await withDb(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `select id from public.activities where title like '[ตัวอย่าง] %' and status = 'open' and not requires_code limit 1`,
    );
    // a real student joins a seed activity (as on demo day)
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: realStudent!.id, role: "authenticated" })]);
    await c.query("select public.join_activity($1)", [rows[0].id]);
    await c.query("commit");
    return rows[0].id;
  });
  try {
    const before = await counts();
    const r = run("reset-demo");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("demo:purge");
    expect(await counts()).toEqual(before);
  } finally {
    await withDb((c) => c.query("delete from public.participations where activity_id = $1 and student_id = $2", [activityId, realStudent!.id]));
  }
});

test("purge dry-run deletes nothing; purge --yes leaves only real admins", async () => {
  const before = await counts();
  const dry = run("purge-users");
  expect(dry.status, dry.stderr).toBe(0);
  expect(dry.stdout).toMatch(/dry/i);
  expect(await counts()).toEqual(before);
  expect(dry.stdout + dry.stderr).not.toContain(realStudent!.email);

  const yes = run("purge-users", ["--yes"]);
  expect(yes.status, yes.stderr).toBe(0);
  expect(yes.stdout + yes.stderr).not.toContain(realStudent!.email);
  const left = await withDb(async (c) =>
    (await c.query<{ id: string; role: string; is_demo: boolean }>(
      `select u.id, p.role, p.is_demo from auth.users u left join public.profiles p on p.id = u.id`,
    )).rows,
  );
  expect(left.length).toBeGreaterThanOrEqual(1);
  for (const u of left) expect([u.role, u.is_demo]).toEqual(["admin", false]);
  expect(left.some((u) => u.id === realAdmin!.id)).toBe(true);
  expect(await role(realStudent!.id)).toBeNull();
  realStudent = undefined; // already gone
  const evidence = await withDb(async (c) =>
    (await c.query(`select count(*)::int n from storage.objects where bucket_id = 'evidence'`)).rows[0].n,
  );
  expect(evidence).toBe(0);
  expect((await counts())["public.orders"]).toBe(0);
});

test("after a purge, reset-demo recreates the demo data (left seeded for `supabase test db`)", async () => {
  const r = run("reset-demo");
  expect(r.status, r.stderr).toBe(0);
  expect(await role(realAdmin!.id)).toEqual({ role: "admin", is_demo: false });
  const demo = await withDb(async (c) =>
    (await c.query(`select count(*)::int n from public.profiles p join auth.users u on u.id = p.id where u.email = any($1) and p.is_demo`, [Object.values(DEMO)])).rows[0].n,
  );
  expect(demo).toBe(3);
  const now = await counts();
  // same seed as before; only the real student created by this file is gone
  expect(now["public.activities"]).toBe(afterSeed!["public.activities"]);
  expect(now["public.submissions"]).toBe(afterSeed!["public.submissions"]);
  expect(now["public.orders"]).toBe(afterSeed!["public.orders"]);
});
