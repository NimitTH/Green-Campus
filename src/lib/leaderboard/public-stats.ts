import { cacheLife } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { parsePublicStats, type PublicStats } from "./format";

/**
 * Whole-school totals for the home page (public_stats(), anonymous). Cached for a few minutes: it is
 * the same public data for everyone and uses no cookies. Throws on failure (a failure is not cached);
 * callers show a quiet fallback.
 */
export async function getPublicStats(): Promise<PublicStats> {
  "use cache";
  cacheLife("minutes");
  const { data, error } = await createAnonClient().rpc("public_stats");
  if (error) throw new Error(`public_stats: ${error.message}`);
  const stats = parsePublicStats(data);
  if (!stats) throw new Error("public_stats: unexpected result");
  return stats;
}
