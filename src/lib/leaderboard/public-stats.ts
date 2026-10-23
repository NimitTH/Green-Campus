import { cacheLife } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { parsePublicStats, type PublicStats } from "./format";

/**
 * Whole-school totals for the home page (public_stats(), anonymous). Cached for a few minutes: it is
 * the same public data for everyone and uses no cookies. Returns null on failure, cached only for
 * seconds: a throw inside "use cache" fails the whole `next build` prerender of "/" (e.g. a paused
 * Supabase project at deploy time), even when the caller catches it. Callers show a quiet fallback.
 */
export async function getPublicStats(): Promise<PublicStats | null> {
  "use cache";
  const { data, error } = await createAnonClient().rpc("public_stats");
  const stats = error ? null : parsePublicStats(data);
  if (!stats) {
    console.error(error ? "public_stats failed" : "public_stats: unexpected result");
    cacheLife("seconds");
    return null;
  }
  cacheLife("minutes");
  return stats;
}
