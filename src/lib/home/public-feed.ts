import { cacheLife } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

export type PublicActivity = { id: string; title: string; type: string; startsAt: string; endsAt: string };
export type PublicReward = { id: string; name: string; pointsCost: number; stock: number; imageUrl: string | null };

const REWARD_BUCKET = "reward-images";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** public_open_activities() rows -> PublicActivity[]; null when the shape is unexpected. */
export function parseOpenActivities(data: unknown): PublicActivity[] | null {
  if (!Array.isArray(data)) return null;
  const out: PublicActivity[] = [];
  for (const row of data) {
    if (!isObj(row)) return null;
    const { id, title, type, starts_at, ends_at } = row;
    if (typeof id !== "string" || typeof title !== "string" || typeof type !== "string") return null;
    if (typeof starts_at !== "string" || typeof ends_at !== "string") return null;
    out.push({ id, title, type, startsAt: starts_at, endsAt: ends_at });
  }
  return out;
}

/** public_active_rewards() rows -> PublicReward[]; toUrl runs only for rows that have an image_path. */
export function parseActiveRewards(data: unknown, toUrl: (path: string) => string): PublicReward[] | null {
  if (!Array.isArray(data)) return null;
  const out: PublicReward[] = [];
  for (const row of data) {
    if (!isObj(row)) return null;
    const { id, name, points_cost, stock, image_path } = row;
    if (typeof id !== "string" || typeof name !== "string") return null;
    if (typeof points_cost !== "number" || typeof stock !== "number") return null;
    if (image_path !== null && image_path !== undefined && typeof image_path !== "string") return null;
    out.push({ id, name, pointsCost: points_cost, stock, imageUrl: image_path ? toUrl(image_path) : null });
  }
  return out;
}

/**
 * Open, not-yet-ended activities for the anonymous home page (public_open_activities()). Cached for a few
 * minutes; null on failure (cached only seconds), never a throw inside a cache scope (see public-stats.ts).
 */
export async function getOpenActivities(): Promise<PublicActivity[] | null> {
  "use cache";
  const { data, error } = await createAnonClient().rpc("public_open_activities", { p_limit: 3 });
  const rows = error ? null : parseOpenActivities(data);
  if (!rows) {
    console.error(error ? "public_open_activities failed" : "public_open_activities: unexpected result");
    cacheLife("seconds");
    return null;
  }
  cacheLife("minutes");
  return rows;
}

/** Active in-stock rewards for the anonymous home page (public_active_rewards()); same cache/error rules. */
export async function getActiveRewards(): Promise<PublicReward[] | null> {
  "use cache";
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("public_active_rewards", { p_limit: 4 });
  const rows = error
    ? null
    : parseActiveRewards(data, (path) => supabase.storage.from(REWARD_BUCKET).getPublicUrl(path).data.publicUrl);
  if (!rows) {
    console.error(error ? "public_active_rewards failed" : "public_active_rewards: unexpected result");
    cacheLife("seconds");
    return null;
  }
  cacheLife("minutes");
  return rows;
}
