import "server-only";
import { createServerClient } from "@/lib/supabase/server";

// Read helpers for reward and cart pages. They run as the signed-in user, so RLS decides what
// is visible (students: active rewards and their own cart; staff: every reward). Callers check
// the role via the DAL.

export const REWARD_BUCKET = "reward-images";

export type RewardRow = {
  id: string;
  name: string;
  points_cost: number;
  stock: number;
  active: boolean;
  image_path: string | null;
};

export type Reward = RewardRow & { imageUrl: string | null };

const COLUMNS = "id, name, points_cost, stock, active, image_path";

async function withImageUrls(rows: RewardRow[]): Promise<Reward[]> {
  const supabase = await createServerClient();
  return rows.map((row) => ({
    ...row,
    imageUrl: row.image_path ? supabase.storage.from(REWARD_BUCKET).getPublicUrl(row.image_path).data.publicUrl : null,
  }));
}

/** Every reward, newest first, including inactive ones (staff manager). */
export async function listRewardsForStaff(): Promise<Reward[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("rewards").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(`listRewardsForStaff: ${error.message}`);
  return withImageUrls((data ?? []) as RewardRow[]);
}

/** Rewards open for redemption (staff would also see inactive ones through RLS, so filter). */
export async function listActiveRewards(): Promise<Reward[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("rewards")
    .select(COLUMNS)
    .eq("active", true)
    .order("points_cost", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listActiveRewards: ${error.message}`);
  return withImageUrls((data ?? []) as RewardRow[]);
}

export async function getReward(id: string): Promise<Reward | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("rewards").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getReward: ${error.message}`);
  if (!data) return null;
  return (await withImageUrls([data as RewardRow]))[0];
}

/** Points balance of a student (0 when there is no ledger row yet). */
export async function getBalance(studentId: string): Promise<number> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("student_balance").select("points").eq("student_id", studentId).maybeSingle();
  if (error) throw new Error(`getBalance: ${error.message}`);
  return Number((data as { points: number | string } | null)?.points ?? 0);
}

export type CartLine = {
  rewardId: string;
  qty: number;
  /** null when the student can no longer read the reward (it was turned off, RLS hides it). */
  reward: Reward | null;
};

type CartRow = { reward_id: string; qty: number; rewards: RewardRow | RewardRow[] | null };

/** The student's cart, oldest line first. */
export async function listCartLines(studentId: string): Promise<CartLine[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select(`reward_id, qty, rewards(${COLUMNS})`)
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listCartLines: ${error.message}`);
  const rows = (data ?? []) as unknown as CartRow[];
  const rewards = rows.map((r) => (Array.isArray(r.rewards) ? (r.rewards[0] ?? null) : r.rewards));
  const withUrls = await withImageUrls(rewards.filter((r): r is RewardRow => r !== null));
  const byId = new Map(withUrls.map((r) => [r.id, r]));
  return rows.map((r) => ({ rewardId: r.reward_id, qty: r.qty, reward: byId.get(r.reward_id) ?? null }));
}

/** Total points of the lines that can still be redeemed (active rewards). */
export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => (l.reward?.active ? sum + l.qty * l.reward.points_cost : sum), 0);
}

/** Number of pieces in the student's cart (sum of qty), for the cart badge on /rewards. */
export async function cartItemCount(studentId: string): Promise<number> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("cart_items").select("qty").eq("student_id", studentId);
  if (error) throw new Error(`cartItemCount: ${error.message}`);
  return ((data ?? []) as { qty: number }[]).reduce((sum, r) => sum + r.qty, 0);
}
