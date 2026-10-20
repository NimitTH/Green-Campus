import { createServerClient } from "@/lib/supabase/server";

export type LeaderboardPeriod = "month" | "all";
/** rank is null for a student caller without a positive total in the period (shown as unranked, carbon 0). */
export type LeaderboardRow = { rank: number | null; displayName: string; carbonKg: number; isMe: boolean };

export function parsePeriod(raw: string | string[] | undefined): LeaderboardPeriod {
  return raw === "all" ? "all" : "month";
}

/** Top 10 plus the caller's own row (leaderboard(), signed-in session; read after the session check). */
export async function getLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("leaderboard", { p_period: period });
  if (error) throw new Error(`leaderboard: ${error.message}`);
  return ((data ?? []) as { rank: number | null; display_name: string; carbon_kg: number | string; is_me: boolean }[]).map((r) => ({
    rank: r.rank === null ? null : Number(r.rank),
    displayName: r.display_name,
    carbonKg: Number(r.carbon_kg),
    isMe: r.is_me,
  }));
}
