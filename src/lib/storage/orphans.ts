import type { SupabaseClient } from "@supabase/supabase-js";

// Orphan image cleanup (Task 19, R129-R132; spec 8.4): pure selection plus the Storage API plumbing.
// The service-role client is passed in; deletes go through Storage remove(), never SQL on storage.objects.

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
const PAGE = 1000;

export type StoredObject = { bucket: string; name: string; createdAt: Date };
export type OrphanRef = { bucket: string; name: string };

function isPlaceholder(name: string): boolean {
  return name === ".emptyFolderPlaceholder" || name.endsWith("/.emptyFolderPlaceholder");
}

/** Objects in a known bucket that no row references and that are STRICTLY older than minAgeMs. */
export function selectOrphans(
  objects: StoredObject[],
  referenced: Record<string, Set<string>>,
  now: Date,
  minAgeMs: number = MIN_AGE_MS,
): OrphanRef[] {
  const result: OrphanRef[] = [];
  for (const o of objects) {
    if (isPlaceholder(o.name)) continue;
    const refs = referenced[o.bucket];
    if (!refs) continue; // unknown bucket: never touched
    if (refs.has(o.name)) continue;
    if (Number.isNaN(o.createdAt.getTime())) continue;
    if (now.getTime() - o.createdAt.getTime() > minAgeMs) result.push({ bucket: o.bucket, name: o.name });
  }
  return result;
}

/** Every file in a bucket, recursing into folders (entries with a null id), paginated. */
export async function listBucket(client: SupabaseClient, bucket: string): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  async function walk(prefix: string): Promise<void> {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await client.storage.from(bucket).list(prefix, { limit: PAGE, offset });
      if (error) throw new Error(`list ${bucket} failed: ${error.message}`);
      const entries = data ?? [];
      for (const e of entries) {
        const full = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null || e.id === undefined) await walk(full);
        else if (e.created_at) out.push({ bucket, name: full, createdAt: new Date(e.created_at) });
      }
      if (entries.length < PAGE) break;
    }
  }
  await walk("");
  return out;
}

/** The non-null referenced paths of one bucket's column, paginated. */
export async function loadReferenced(client: SupabaseClient, bucket: Bucket): Promise<Set<string>> {
  const { table, column } = REFERENCES[bucket];
  const set = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select(column).not(column, "is", null).range(from, from + PAGE - 1);
    if (error) throw new Error(`load references for ${bucket} failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Record<string, string | null>[];
    for (const r of rows) if (r[column]) set.add(r[column] as string);
    if (rows.length < PAGE) break;
  }
  return set;
}

export type CleanupResult = {
  deleted: number;
  byBucket: Record<Bucket, number>;
  scanned: number;
  dryRun: boolean;
  capped: boolean;
};

export async function runCleanup(client: SupabaseClient, opts: { dryRun: boolean; now?: Date }): Promise<CleanupResult> {
  const now = opts.now ?? new Date();
  // List first, load references AFTER, so a file uploaded and referenced mid-run is protected.
  const objects: StoredObject[] = [];
  for (const b of BUCKETS) objects.push(...(await listBucket(client, b)));
  const referenced: Record<string, Set<string>> = {};
  for (const b of BUCKETS) referenced[b] = await loadReferenced(client, b);

  const orphans = selectOrphans(objects, referenced, now);
  const capped = orphans.length > MAX_DELETIONS;
  const chosen = orphans.slice(0, MAX_DELETIONS);
  const byBucket: Record<Bucket, number> = { evidence: 0, "reward-images": 0, "article-images": 0 };

  for (const b of BUCKETS) {
    const names = chosen.filter((o) => o.bucket === b).map((o) => o.name);
    if (opts.dryRun) {
      byBucket[b] = names.length;
      continue;
    }
    for (let i = 0; i < names.length; i += REMOVE_BATCH) {
      const batch = names.slice(i, i + REMOVE_BATCH);
      const { data, error } = await client.storage.from(b).remove(batch);
      if (error) throw new Error(`remove from ${b} failed: ${error.message}`);
      byBucket[b] += data ? data.length : batch.length;
    }
  }
  const deleted = BUCKETS.reduce((n, b) => n + byBucket[b], 0);
  return { deleted, byBucket, scanned: objects.length, dryRun: opts.dryRun, capped };
}
