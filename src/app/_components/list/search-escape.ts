// DESIGN-3 5.1: search text inside a PostgREST `.or()` filter, matched literally.
//
// Verified against the local PostgREST (supabase CLI 2.121):
// * quoteOrValue: inside "…" the separators , ( ) are plain text; \" and \\ are the only escapes PostgREST
//   unwraps (so `a,b"(%` neither splits the filter nor errors).
// * toIlikePattern: \ % _ are escaped with \ (Postgres' default LIKE escape), so they match themselves.
// * `*` cannot be matched literally: PostgREST rewrites every * in a like/ilike value to %, before the LIKE
//   escape applies (\* still becomes \%, a literal percent sign). It is therefore mapped to _ (exactly one
//   character), the closest safe match: never an error, results only slightly broader.

/** `%q%` for ilike with \ % _ escaped and * mapped to _. */
export function toIlikePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, "_")}%`;
}

/** A value for a PostgREST logic tree (`.or()`), double-quoted with " and \ escaped. */
export function quoteOrValue(v: string): string {
  return `"${v.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}
