import type { SupabaseClient } from "@supabase/supabase-js";

// Orphan image cleanup (Task 19, R129-R133; spec 8.4). Candidates come from one read-only SQL function
// (migration 0023, keyset-paged by name, service_role only); objects are DELETED only through the Storage
// API. Before every remove() batch the batch is re-checked against the referencing column, so a file that
// became referenced after listing is never removed. Any read error aborts the run with no further deletes.

export const BUCKETS = ["evidence", "reward-images", "article-images"] as const;
export type Bucket = (typeof BUCKETS)[number];

/** The column that references each bucket's objects by full path. */
export const REFERENCES: Record<Bucket, { table: string; column: string }> = {
  evidence: { table: "submissions", column: "evidence_path" },
  "reward-images": { table: "rewards", column: "image_path" },
  "article-images": { table: "articles", column: "cover_path" },
};

export const MIN_AGE_MS = 24 * 60 * 60_000;
export const REMOVE_BATCH = 100;
export const MAX_DELETIONS = 2000;
export const CANDIDATE_PAGE = 500;

/** A failure with a stage code that is safe to log (never the underlying message). */
export class CleanupError extends Error {
  constructor(readonly stage: string) {
    super(stage);
  }
}

export type CleanupResult = {
  deleted: number;
  byBucket: Record<Bucket, number>;
  scanned: number;
  dryRun: boolean;
  capped: boolean;
};

/** Old, unreferenced names of one bucket in name order, keyset-paged until an EMPTY page, up to `budget`. */
async function listCandidates(client: SupabaseClient, bucket: Bucket, cutoff: string, budget: number) {
  const names: string[] = [];
  let capped = false;
  let after = "";
  outer: for (;;) {
    const { data, error } = await client.rpc("storage_orphan_candidates", {
      p_bucket: bucket,
      p_older_than: cutoff,
      p_after: after,
      p_limit: CANDIDATE_PAGE,
    });
    if (error) throw new CleanupError(`list_failed:${bucket}`);
    const rows = (data ?? []) as { name: string }[];
    if (rows.length === 0) break; // only an empty page ends the listing: short pages are legal
    for (const row of rows) {
      if (names.length >= budget) {
        capped = true;
        break outer;
      }
      names.push(row.name);
    }
    const last = rows[rows.length - 1].name;
    if (last <= after) throw new CleanupError(`list_failed:${bucket}`); // no progress: never loop forever
    after = last;
  }
  return { names, capped };
}

/** The names in `batch` that a row references right now. */
async function referencedNow(client: SupabaseClient, bucket: Bucket, batch: string[]): Promise<Set<string>> {
  const { table, column } = REFERENCES[bucket];
  const { data, error } = await client.from(table).select(column).in(column, batch);
  if (error) throw new CleanupError("recheck_failed");
  const rows = (data ?? []) as unknown as Record<string, string | null>[];
  return new Set(rows.map((r) => r[column]).filter((v): v is string => !!v));
}

export async function runCleanup(client: SupabaseClient, opts: { dryRun: boolean; now?: Date }): Promise<CleanupResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - MIN_AGE_MS).toISOString(); // strictly older than 24h
  const byBucket: Record<Bucket, number> = { evidence: 0, "reward-images": 0, "article-images": 0 };
  let scanned = 0;
  let capped = false;
  let budget = MAX_DELETIONS;

  for (const bucket of BUCKETS) {
    const found = await listCandidates(client, bucket, cutoff, budget);
    if (found.capped) capped = true;
    scanned += found.names.length;
    budget -= found.names.length;

    for (let i = 0; i < found.names.length; i += REMOVE_BATCH) {
      const batch = found.names.slice(i, i + REMOVE_BATCH);
      const referenced = await referencedNow(client, bucket, batch);
      const safe = batch.filter((n) => !referenced.has(n));
      if (safe.length === 0) continue;
      if (opts.dryRun) {
        byBucket[bucket] += safe.length;
        continue;
      }
      const { data, error } = await client.storage.from(bucket).remove(safe);
      if (error) throw new CleanupError("remove_failed");
      byBucket[bucket] += data ? data.length : safe.length;
    }
  }
  const deleted = BUCKETS.reduce((n, b) => n + byBucket[b], 0);
  return { deleted, byBucket, scanned, dryRun: opts.dryRun, capped };
}
