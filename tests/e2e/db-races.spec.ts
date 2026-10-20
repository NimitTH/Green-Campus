import { expect, test } from "@playwright/test";
import pg from "pg";
import {
  checkoutAs,
  createConfirmedUser,
  createRewardRow,
  deleteRewardsByName,
  deleteUsers,
  findReward,
  grantPoints,
  ledgerBalance,
  listLedgerForOrder,
  listOrders,
  type TestUser,
} from "./helpers/supabase-admin";

// Spec 11 / Phase 2 review R92: concurrent redeems never make points negative or oversell stock.
// These tests FORCE the overlap with two real database sessions instead of hoping Promise.all
// interleaves: A begins and runs its function (holding its row locks, not committed), B runs its
// function in its own transaction, and the test polls pg_stat_activity until B is blocked on a lock
// (wait_event_type = 'Lock'). Only then does A commit; B finishes and commits after it.
// Each session impersonates a user the way PostgREST does: `set local role authenticated` plus
// request.jwt.claims, inside the transaction. Database only (no browser): runs in chromium only.

const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

type Session = { client: pg.Client; pid: number };
type Settled = { ok: true; rows: Record<string, unknown>[] } | { ok: false; code: string | undefined; message: string };

function localDbUrl(): string {
  const host = new URL(DB_URL).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`db-races: refusing to use non-local database (${host})`);
  return DB_URL;
}

async function connect(): Promise<Session> {
  const client = new pg.Client({ connectionString: localDbUrl() });
  await client.connect();
  const { rows } = await client.query<{ pid: number }>("select pg_backend_pid() as pid");
  return { client, pid: rows[0].pid };
}

/** BEGIN and act as `userId` (an authenticated end user) for the rest of the transaction. */
async function beginAs(s: Session, userId: string): Promise<void> {
  await s.client.query("begin");
  await s.client.query("set local role authenticated");
  await s.client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
}

/** Run a query without awaiting it; the promise never rejects (errors come back as values). */
function start(s: Session, sql: string, params: unknown[] = []): Promise<Settled> {
  return s.client.query(sql, params).then(
    (r) => ({ ok: true as const, rows: r.rows as Record<string, unknown>[] }),
    (e: { code?: string; message: string }) => ({ ok: false as const, code: e.code, message: e.message }),
  );
}

/** Poll (from a separate autocommit session) until backend `pid` waits on a lock. */
async function waitForLock(monitor: Session, pid: number, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await monitor.client.query<{ wait_event_type: string | null; wait_event: string | null }>(
      "select wait_event_type, wait_event from pg_stat_activity where pid = $1",
      [pid],
    );
    if (rows[0]?.wait_event_type === "Lock") return rows[0].wait_event ?? "";
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`db-races: backend ${pid} never waited on a lock, the overlap was not forced`);
}

/** Wait until a started query either finished or is blocked on a lock. */
async function finishedOrBlocked(monitor: Session, pid: number, p: Promise<Settled>, timeoutMs = 10_000): Promise<"finished" | "blocked"> {
  let done = false;
  void p.then(() => (done = true));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (done) return "finished";
    const { rows } = await monitor.client.query<{ wait_event_type: string | null }>(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [pid],
    );
    if (rows[0]?.wait_event_type === "Lock" && !done) return "blocked";
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`db-races: backend ${pid} neither finished nor blocked`);
}

async function endTx(s: Session, settled: Settled): Promise<void> {
  await s.client.query(settled.ok ? "commit" : "rollback");
}

function result(settled: Settled): { ok: boolean; error_code: string | null; order_id: string | null; blocked: { reason: string; available?: number }[] } {
  if (!settled.ok) throw new Error(`db-races: query failed (${settled.code}): ${settled.message}`);
  return settled.rows[0].r as never;
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

let a: Session;
let b: Session;
let monitor: Session;

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "database-only test, run once");
  [a, b, monitor] = await Promise.all([connect(), connect(), connect()]);
});

test.afterEach(async () => {
  for (const s of [a, b, monitor]) {
    if (!s) continue;
    await s.client.query("rollback").catch(() => undefined);
    await s.client.end().catch(() => undefined);
  }
});

/** Invariants for one reward and its students: nothing oversold, nobody negative, refunds <= 1. */
async function expectConsistent(rewardName: string, initialStock: number, students: TestUser[], granted: number): Promise<void> {
  const reward = await findReward(rewardName);
  expect(reward).not.toBeNull();
  const { rows } = await monitor.client.query<{ held: string }>(
    `select coalesce(sum(oi.qty), 0) as held from public.order_items oi join public.orders o on o.id = oi.order_id
     where oi.reward_id = $1 and o.status in ('pending_pickup', 'completed')`,
    [reward!.id],
  );
  expect(reward!.stock).toBeGreaterThanOrEqual(0);
  expect(reward!.stock + Number(rows[0].held)).toBe(initialStock);
  for (const s of students) {
    const balance = await ledgerBalance(s.id);
    expect(balance).toBeGreaterThanOrEqual(0);
    const orders = await listOrders(s.id);
    const spent = orders.filter((o) => o.status === "pending_pickup" || o.status === "completed").reduce((sum, o) => sum + o.total_points, 0);
    expect(balance).toBe(granted - spent);
    for (const o of orders) {
      const ledger = await listLedgerForOrder(o.id);
      expect(ledger.filter((l) => l.kind === "redeem")).toHaveLength(1);
      expect(ledger.filter((l) => l.kind === "refund").length).toBeLessThanOrEqual(o.status === "cancelled" || o.status === "expired" ? 1 : 0);
    }
  }
}

async function putInCart(studentId: string, rewardId: string, qty: number): Promise<void> {
  await monitor.client.query("insert into public.cart_items (student_id, reward_id, qty) values ($1, $2, $3)", [studentId, rewardId, qty]);
}

test("(a) one student, points for one order, two overlapping checkouts: one order, balance never negative", async () => {
  const suffix = uniqueSuffix();
  const name = `race-a ${suffix}`;
  let student: TestUser | undefined;
  try {
    student = await createConfirmedUser("student", `race-a-${suffix}`);
    await grantPoints(student.id, 10);
    const rewardId = await createRewardRow(name, 10, 5);
    await putInCart(student.id, rewardId, 1);

    await beginAs(a, student.id);
    const first = await start(a, "select public.checkout() as r");
    expect(result(first).ok).toBe(true); // A holds the profile lock, not committed
    await beginAs(b, student.id);
    const second = start(b, "select public.checkout() as r");
    await waitForLock(monitor, b.pid); // B queues on the profile row
    await a.client.query("commit");
    const settled = await second;
    await endTx(b, settled);

    const r = result(settled);
    expect(r.ok).toBe(false);
    const pointsBlocked = r.error_code === "blocked" && r.blocked.some((x) => x.reason === "points");
    expect(r.error_code === "cart_empty" || pointsBlocked).toBe(true);
    expect(await ledgerBalance(student.id)).toBe(0);
    expect(await listOrders(student.id)).toHaveLength(1);
    await expectConsistent(name, 5, [student], 10);
  } finally {
    await deleteUsers([student]);
    await deleteRewardsByName([name]);
  }
});

test("(b) stock 1, two students check out at once: one order, stock 0, the other blocked on stock", async () => {
  const suffix = uniqueSuffix();
  const name = `race-b ${suffix}`;
  let s1: TestUser | undefined;
  let s2: TestUser | undefined;
  try {
    s1 = await createConfirmedUser("student", `race-b1-${suffix}`);
    s2 = await createConfirmedUser("student", `race-b2-${suffix}`);
    await grantPoints(s1.id, 10);
    await grantPoints(s2.id, 10);
    const rewardId = await createRewardRow(name, 10, 1);
    await putInCart(s1.id, rewardId, 1);
    await putInCart(s2.id, rewardId, 1);

    await beginAs(a, s1.id);
    expect(result(await start(a, "select public.checkout() as r")).ok).toBe(true);
    await beginAs(b, s2.id);
    const second = start(b, "select public.checkout() as r");
    await waitForLock(monitor, b.pid); // B queues on the reward row
    await a.client.query("commit");
    const settled = await second;
    await endTx(b, settled);

    const r = result(settled);
    expect(r.ok).toBe(false);
    expect(r.error_code).toBe("blocked");
    expect(r.blocked).toEqual([expect.objectContaining({ reason: "stock", available: 0 })]);
    expect((await findReward(name))?.stock).toBe(0);
    expect((await listOrders(s1.id)).length + (await listOrders(s2.id)).length).toBe(1);
    expect(await ledgerBalance(s2.id)).toBe(10);
    await expectConsistent(name, 1, [s1, s2], 10);
  } finally {
    await deleteUsers([s1, s2]);
    await deleteRewardsByName([name]);
  }
});

/** A student with one pending order for the only unit of a reward and one more in the cart. */
async function seedCancelRace(tag: string) {
  const suffix = uniqueSuffix();
  const name = `race-${tag} ${suffix}`;
  const teacher = await createConfirmedUser("teacher", `race-${tag}-t-${suffix}`);
  const student = await createConfirmedUser("student", `race-${tag}-s-${suffix}`);
  await grantPoints(student.id, 20);
  const rewardId = await createRewardRow(name, 10, 1);
  const orderId = await checkoutAs(student, rewardId, 1); // stock 1 -> 0, balance 20 -> 10
  await putInCart(student.id, rewardId, 1);
  return { name, teacher, student, rewardId, orderId };
}

test("(c) cancel_order (staff) vs checkout (the same student) on one reward: no deadlock, consistent stock and ledger", async () => {
  const seed = await seedCancelRace("c");
  try {
    await beginAs(a, seed.teacher.id);
    const cancel = await start(a, "select public.cancel_order($1)", [seed.orderId]);
    expect(cancel.ok).toBe(true); // A holds the order and the reward, not committed
    await beginAs(b, seed.student.id);
    const checkout = start(b, "select public.checkout() as r");
    await waitForLock(monitor, b.pid); // B waits for the reward row
    await a.client.query("commit");
    const settled = await checkout;
    expect(settled.ok ? "" : settled.code).not.toBe("40P01");
    await endTx(b, settled);

    expect(result(settled).ok).toBe(true); // B read balance 10 and, after A, stock 1
    expect((await findReward(seed.name))?.stock).toBe(0);
    expect((await listLedgerForOrder(seed.orderId)).filter((l) => l.kind === "refund")).toHaveLength(1);
    expect(await ledgerBalance(seed.student.id)).toBe(10);
    await expectConsistent(seed.name, 1, [seed.student], 20);
  } finally {
    await deleteUsers([seed.student, seed.teacher]);
    await deleteRewardsByName([seed.name]);
  }
});

// Can the test above fail? With whole-function calls in the order above it cannot deadlock even with
// a FOR UPDATE profile lock (B would simply wait on the profile). The deadlock needs B to hold the
// profile BEFORE the cancel inserts its refund. So the next test runs a scratch copy of the live
// checkout() with an advisory-lock "gate" right after the profile lock: B takes the profile lock and
// stops at the gate, A runs cancel_order (order -> reward -> FK KEY SHARE on the profile), then the
// gate opens and B goes for the reward A holds. With the real NO KEY UPDATE lock this passes; with
// FOR UPDATE (the mistake 0014 avoids) Postgres reports 40P01, so the harness does detect it.
for (const mode of ["no key update", "update"] as const) {
  test(`(c, gated) profile lock FOR ${mode.toUpperCase()}: ${mode === "update" ? "deadlocks (40P01)" : "no deadlock"}`, async () => {
    const fn = `race_checkout_gated_${mode === "update" ? "fu" : "nku"}_${process.pid}`;
    const gate = 924_000 + (mode === "update" ? 1 : 2);
    const seed = await seedCancelRace(`g${mode === "update" ? "u" : "n"}`);
    try {
      const { rows } = await monitor.client.query<{ def: string }>("select pg_get_functiondef('public.checkout()'::regprocedure) as def");
      const lockLine = "where p.id = v_uid for no key update;";
      expect(rows[0].def.split(lockLine)).toHaveLength(2); // the live checkout locks the profile exactly once
      const scratch = rows[0].def
        .replace("public.checkout()", `public.${fn}()`)
        .replace(lockLine, `where p.id = v_uid for ${mode};\n  perform pg_advisory_xact_lock(${gate});`);
      await monitor.client.query(scratch);
      await monitor.client.query(`grant execute on function public.${fn}() to authenticated`);
      await monitor.client.query("select pg_advisory_lock($1)", [gate]); // close the gate

      await beginAs(b, seed.student.id);
      const checkout = start(b, `select public.${fn}() as r`);
      expect(await waitForLock(monitor, b.pid)).toBe("advisory"); // B holds the profile, at the gate
      await beginAs(a, seed.teacher.id);
      const cancel = start(a, "select public.cancel_order($1)", [seed.orderId]);
      const state = await finishedOrBlocked(monitor, a.pid, cancel);
      await monitor.client.query("select pg_advisory_unlock($1)", [gate]); // open the gate

      if (state === "finished") {
        expect((await cancel).ok).toBe(true);
        await waitForLock(monitor, b.pid); // B now waits for the reward A holds
        await a.client.query("commit");
      }
      const [cancelSettled, checkoutSettled] = await Promise.all([cancel, checkout]);
      const codes = [cancelSettled, checkoutSettled].map((s) => (s.ok ? null : s.code));
      if (state === "blocked") {
        // A waited for the profile while B held it: the gate opening makes B wait for A's reward
        await endTx(a, cancelSettled);
      }
      await endTx(b, checkoutSettled);

      if (mode === "update") {
        expect(state).toBe("blocked");
        expect(codes).toContain("40P01");
      } else {
        expect(state).toBe("finished");
        expect(codes).toEqual([null, null]);
        expect(result(checkoutSettled).ok).toBe(true);
      }
      // whichever side survived, the books balance
      expect((await listLedgerForOrder(seed.orderId)).filter((l) => l.kind === "refund").length).toBeLessThanOrEqual(1);
      await expectConsistent(seed.name, 1, [seed.student], 20);
    } finally {
      await monitor.client.query("select pg_advisory_unlock_all()").catch(() => undefined);
      await monitor.client.query(`drop function if exists public.${fn}()`).catch(() => undefined);
      await deleteUsers([seed.student, seed.teacher]);
      await deleteRewardsByName([seed.name]);
    }
  });
}
