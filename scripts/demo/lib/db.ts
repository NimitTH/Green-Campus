import type pg from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";

// Database helpers of the demo scripts.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function assertUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new Error("internal: not a uuid");
  return id;
}

/**
 * Run one SQL statement as the signed-in end user `uid`, inside the caller's open transaction, the way
 * PostgREST does and the pgTAP tests do: `set local role authenticated` plus the JWT claims (auth.uid()
 * reads them), then back to the session role with the claims cleared, so auth.uid() is null again for
 * the postgres-only steps (protect_profile_columns lets role/is_demo changes through only then).
 * One round trip: the statements are sent together (simple query protocol, no parameters), so every
 * value inside `sql` must already be a quoted literal (see `lit`) or a checked uuid.
 * `after` (optional) runs in the same round trip as postgres again, after the claims are cleared.
 * Returns the rows of `sql`.
 */
export async function asUser(db: pg.Client, uid: string, sql: string, after?: string): Promise<Record<string, unknown>[]> {
  const claims = JSON.stringify({ sub: assertUuid(uid), role: "authenticated" });
  const text = [
    "set local role authenticated",
    `select set_config('request.jwt.claims', ${db.escapeLiteral(claims)}, true)`,
    `select set_config('request.jwt.claim.sub', '${uid}', true)`,
    sql,
    "reset role",
    "select set_config('request.jwt.claims', '', true)",
    "select set_config('request.jwt.claim.sub', '', true)",
    ...(after ? [after] : []),
  ].join(";\n");
  const results = (await db.query(text)) as unknown as pg.QueryResult[];
  return results[3].rows as Record<string, unknown>[];
}

/** A quoted SQL literal. */
export function lit(db: pg.Client, value: string | number | null): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("internal: bad number");
    return String(value);
  }
  return db.escapeLiteral(value);
}

export function uuidArray(ids: string[]): string {
  return `array[${ids.map((id) => `'${assertUuid(id)}'`).join(",")}]::uuid[]`;
}

/** Remove storage objects through the Storage API (never SQL, spec 8.4), 100 per call. Returns the count. */
export async function removeObjects(admin: SupabaseClient, bucket: string, names: string[]): Promise<number> {
  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const batch = names.slice(i, i + 100);
    const { data, error } = await admin.storage.from(bucket).remove(batch);
    if (error) throw new Error(`storage remove (${bucket}) failed: ${error.message}`);
    removed += data?.length ?? 0;
  }
  return removed;
}

/** Object names in `bucket` whose first folder is one of `folders` (read-only metadata query). */
export async function objectsInFolders(db: pg.Client, bucket: string, folders: string[]): Promise<string[]> {
  if (folders.length === 0) return [];
  const { rows } = await db.query<{ name: string }>(
    "select name from storage.objects where bucket_id = $1 and split_part(name, '/', 1) = any($2::text[]) order by name",
    [bucket, folders],
  );
  return rows.map((r) => r.name);
}
