import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CANDIDATE_PAGE, CleanupError, MAX_DELETIONS, REMOVE_BATCH, runCleanup } from "./orphans";

const NOW = new Date("2026-10-21T12:00:00Z");
const names = (n: number, p = "f") => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(5, "0")}.jpg`);

type Opts = {
  files?: Record<string, string[]>; // candidate names per bucket (already old + unreferenced), sorted
  pageCap?: number; // server-side max rows per rpc page
  becomesReferenced?: string[]; // referenced at re-check time only
  rpcError?: boolean;
  recheckError?: boolean;
  removeError?: boolean;
};

/** A fake admin client that records the order of calls. */
function fake(o: Opts = {}) {
  const calls: string[] = [];
  const removed: string[][] = [];
  const rpc = vi.fn(async (fn: string, a: { p_bucket: string; p_after: string; p_limit: number }) => {
    calls.push(`rpc:${a.p_bucket}`);
    if (o.rpcError) return { data: null, error: { message: "secret path boom" } };
    const limit = Math.min(a.p_limit, o.pageCap ?? 1000);
    const rows = (o.files?.[a.p_bucket] ?? []).filter((n) => n > a.p_after).slice(0, limit);
    return { data: rows.map((name) => ({ name, created_at: "2026-01-01T00:00:00Z" })), error: null };
  });
  const client = {
    rpc,
    from: (table: string) => ({
      select: (column: string) => ({
        in: async (_c: string, batch: string[]) => {
          calls.push(`recheck:${table}`);
          if (o.recheckError) return { data: null, error: { message: "boom" } };
          return { data: batch.filter((n) => o.becomesReferenced?.includes(n)).map((n) => ({ [column]: n })), error: null };
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        remove: async (batch: string[]) => {
          calls.push(`remove:${bucket}`);
          if (o.removeError) return { data: null, error: { message: "boom" } };
          removed.push(batch);
          return { data: batch.map((name) => ({ name })), error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { client, calls, removed, rpc };
}

describe("runCleanup", () => {
  it("reads candidates across pages (>1000 rows) and removes them all in batches of 100", async () => {
    const f = fake({ files: { evidence: names(1250) } });
    const r = await runCleanup(f.client, { dryRun: false, now: NOW });
    expect(r.deleted).toBe(1250);
    expect(r.byBucket.evidence).toBe(1250);
    expect(r.capped).toBe(false);
    expect(f.removed.flat()).toEqual(names(1250));
    expect(f.removed.every((b) => b.length <= REMOVE_BATCH)).toBe(true);
    expect(f.removed.length).toBe(13);
  });

  it("keeps reading short pages (server max_rows 200 < page size) until an empty page", async () => {
    const f = fake({ files: { evidence: names(1100) }, pageCap: 200 });
    const r = await runCleanup(f.client, { dryRun: true, now: NOW });
    expect(CANDIDATE_PAGE).toBeGreaterThan(200);
    expect(r.deleted).toBe(1100);
    expect(r.scanned).toBe(1100);
  });

  it("passes a strict 24h cutoff", async () => {
    const f = fake();
    await runCleanup(f.client, { dryRun: true, now: NOW });
    expect(f.rpc.mock.calls[0][1]).toMatchObject({ p_older_than: "2026-10-20T12:00:00.000Z", p_after: "" });
  });

  it("does not remove a name that became referenced between listing and re-check", async () => {
    const f = fake({ files: { evidence: ["a.jpg", "b.jpg", "c.jpg"] }, becomesReferenced: ["b.jpg"] });
    const r = await runCleanup(f.client, { dryRun: false, now: NOW });
    expect(f.removed).toEqual([["a.jpg", "c.jpg"]]);
    expect(r.deleted).toBe(2);
  });

  it("makes no remove() when everything in a batch became referenced", async () => {
    const f = fake({ files: { evidence: ["a.jpg"] }, becomesReferenced: ["a.jpg"] });
    await runCleanup(f.client, { dryRun: false, now: NOW });
    expect(f.calls.some((c) => c.startsWith("remove"))).toBe(false);
  });

  it("an error in the candidate query aborts with zero remove() calls", async () => {
    const f = fake({ files: { evidence: ["a.jpg"] }, rpcError: true });
    await expect(runCleanup(f.client, { dryRun: false, now: NOW })).rejects.toMatchObject({ stage: "list_failed:evidence" });
    expect(f.calls.some((c) => c.startsWith("remove"))).toBe(false);
  });

  it("an error in the re-check aborts with zero remove() calls", async () => {
    const f = fake({ files: { evidence: ["a.jpg"] }, recheckError: true });
    await expect(runCleanup(f.client, { dryRun: false, now: NOW })).rejects.toMatchObject({ stage: "recheck_failed" });
    expect(f.calls.some((c) => c.startsWith("remove"))).toBe(false);
  });

  it("a remove error aborts with a stage code that carries no error message", async () => {
    const f = fake({ files: { evidence: names(250) }, removeError: true });
    const err = await runCleanup(f.client, { dryRun: false, now: NOW }).catch((e) => e);
    expect(err).toBeInstanceOf(CleanupError);
    expect(err.message).toBe("remove_failed");
    expect(f.calls.filter((c) => c.startsWith("remove")).length).toBe(1); // stops at the first failure
  });

  it("calls candidates, then re-check, then remove", async () => {
    const f = fake({ files: { evidence: ["a.jpg"] } });
    await runCleanup(f.client, { dryRun: false, now: NOW });
    const e = f.calls.filter((c) => c.endsWith("evidence") || c.endsWith("submissions"));
    expect(e).toEqual(["rpc:evidence", "rpc:evidence", "recheck:submissions", "remove:evidence"]);
  });

  it("dry run makes no remove() calls but counts", async () => {
    const f = fake({ files: { evidence: names(3), "reward-images": names(2) } });
    const r = await runCleanup(f.client, { dryRun: true, now: NOW });
    expect(r).toMatchObject({ deleted: 5, dryRun: true, byBucket: { evidence: 3, "reward-images": 2, "article-images": 0 } });
    expect(f.calls.some((c) => c.startsWith("remove"))).toBe(false);
  });

  it("caps at 2000 deletions per run and reports capped", async () => {
    const f = fake({ files: { evidence: names(1500), "reward-images": names(1500) } });
    const r = await runCleanup(f.client, { dryRun: false, now: NOW });
    expect(r.deleted).toBe(MAX_DELETIONS);
    expect(r.byBucket).toMatchObject({ evidence: 1500, "reward-images": 500 });
    expect(r.capped).toBe(true);
  });

  it("is not capped at exactly 2000", async () => {
    const f = fake({ files: { evidence: names(2000) } });
    const r = await runCleanup(f.client, { dryRun: true, now: NOW });
    expect(r.deleted).toBe(2000);
    expect(r.capped).toBe(false);
  });

  it("only touches the three known buckets", async () => {
    const f = fake({ files: { evidence: ["a.jpg"], avatars: ["x.jpg"] } });
    await runCleanup(f.client, { dryRun: false, now: NOW });
    expect(f.calls.filter((c) => c.startsWith("remove"))).toEqual(["remove:evidence"]);
  });
});
