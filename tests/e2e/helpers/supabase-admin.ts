import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PNG_1X1 } from "./images";

// Test-only admin access to the LOCAL Supabase stack (service key from .env.local).
// Never print the keys. Always refuses non-local Supabase URLs.

export type Role = "student" | "teacher" | "admin";
export type TestUser = { id: string; email: string; password: string; role: Role };

let client: SupabaseClient | null = null;

/** URL and keys of the LOCAL stack from .env.local; throws for a non-local URL. */
export function localEnv(): { url: string; secretKey: string; publishableKey: string } {
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) {
    throw new Error(
      "e2e: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY must be set in .env.local",
    );
  }
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`e2e: refusing to use non-local Supabase (${host})`);
  }
  return { url, secretKey, publishableKey };
}

function admin(): SupabaseClient {
  if (client) return client;
  const { url, secretKey } = localEnv();
  client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** A confirmed user (no email step) with the given role. */
export async function createConfirmedUser(role: Role, label: string): Promise<TestUser> {
  const email = `e2e-${label}@example.test`.toLowerCase();
  const password = `E2e-${Math.random().toString(36).slice(2, 10)}-pass`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `ทดสอบ ${role}` },
  });
  if (error || !data.user) throw new Error(`e2e: createUser failed: ${error?.message}`);

  if (role !== "student") {
    // Service context: no end-user JWT, so protect_profile_columns allows the role change.
    const { error: roleError } = await admin().from("profiles").update({ role }).eq("id", data.user.id);
    if (roleError) throw new Error(`e2e: role update failed: ${roleError.message}`);
  }
  return { id: data.user.id, email, password, role };
}

export async function deleteUsers(users: (TestUser | undefined)[]): Promise<void> {
  for (const user of users) {
    if (!user) continue;
    const { error } = await admin().auth.admin.deleteUser(user.id);
    if (error) console.warn(`e2e cleanup: deleteUser ${user.email} failed: ${error.message}`);
  }
}

/** Remove activities created by a test (participations cascade, 0004), with their submissions and evidence. */
export async function deleteActivitiesByTitle(title: string): Promise<void> {
  const { data: activities } = await admin().from("activities").select("id").eq("title", title);
  const ids = (activities ?? []).map((a) => (a as { id: string }).id);
  if (ids.length > 0) {
    // An activity with submissions cannot be deleted (0004 trigger): remove them first.
    const { data: subs } = await admin().from("submissions").select("evidence_path").in("activity_id", ids);
    const paths = (subs ?? []).map((s) => (s as { evidence_path: string | null }).evidence_path).filter((p): p is string => !!p);
    if (paths.length > 0) await admin().storage.from("evidence").remove(paths);
    const { error: subError } = await admin().from("submissions").delete().in("activity_id", ids);
    if (subError) console.warn(`e2e cleanup: delete submissions of "${title}" failed: ${subError.message}`);
  }
  const { error } = await admin().from("activities").delete().eq("title", title);
  if (error) console.warn(`e2e cleanup: delete activity "${title}" failed: ${error.message}`);
}

/**
 * An open, code-requiring activity (started 1 h ago, ends in 1 day) the student has already joined.
 * `fields` overrides columns (e.g. type 'waste', requires_code false).
 */
export async function createJoinedCodeActivity(
  title: string,
  studentId: string,
  fields: Record<string, unknown> = {},
): Promise<string> {
  const now = Date.now();
  const { data, error } = await admin()
    .from("activities")
    .insert({
      title,
      type: "fixed",
      unit_points: 10,
      status: "open",
      requires_code: true,
      starts_at: new Date(now - 60 * 60_000).toISOString(),
      ends_at: new Date(now + 24 * 60 * 60_000).toISOString(),
      ...fields,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`e2e: create activity failed: ${error?.message}`);
  const { error: joinError } = await admin()
    .from("participations")
    .insert({ activity_id: data.id, student_id: studentId });
  if (joinError) throw new Error(`e2e: join failed: ${joinError.message}`);
  return data.id as string;
}

/** Submissions of one student for one activity (service role, ignores RLS). */
export async function listSubmissions(
  studentId: string,
  activityId: string,
): Promise<{ id: string; status: string; code_id: string | null; evidence_path: string | null }[]> {
  const { data, error } = await admin()
    .from("submissions")
    .select("id, status, code_id, evidence_path")
    .eq("student_id", studentId)
    .eq("activity_id", activityId);
  if (error) throw new Error(`e2e: list submissions failed: ${error.message}`);
  return (data ?? []) as { id: string; status: string; code_id: string | null; evidence_path: string | null }[];
}

/** Remove evidence files a test uploaded that no submission references. */
export async function removeEvidence(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await admin().storage.from("evidence").remove(paths);
  if (error) console.warn(`e2e cleanup: remove evidence failed: ${error.message}`);
}

/** Weigh codes of one student for one activity, oldest first. */
export async function listWeighCodes(
  studentId: string,
  activityId: string,
): Promise<{ attempts: number; used_at: string | null; revoked_at: string | null }[]> {
  const { data, error } = await admin()
    .from("weigh_codes")
    .select("attempts, used_at, revoked_at")
    .eq("student_id", studentId)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`e2e: list weigh codes failed: ${error.message}`);
  return (data ?? []) as { attempts: number; used_at: string | null; revoked_at: string | null }[];
}

/** A Supabase client signed in as `user` (publishable key: RLS and function checks apply). */
export async function signedInClient(user: TestUser): Promise<SupabaseClient> {
  const { url, publishableKey } = localEnv();
  const c = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`e2e: sign in ${user.email} failed: ${error.message}`);
  return c;
}

/**
 * Submit a result as the student through the real path (upload to evidence, then submit_result).
 * `items` as for submit_result ([] for fixed). Returns the new submission id.
 */
export async function seedSubmission(
  student: TestUser,
  activityId: string,
  image: Buffer,
  items: { waste_category_id?: string; quantity: number }[] = [],
): Promise<string> {
  const c = await signedInClient(student);
  const path = `${student.id}/${randomUUID()}/evidence.png`;
  const { error: uploadError } = await c.storage.from("evidence").upload(path, image, { contentType: "image/png" });
  if (uploadError) throw new Error(`e2e: evidence upload failed: ${uploadError.message}`);
  const { data, error } = await c.rpc("submit_result", {
    p_activity_id: activityId,
    p_code: null,
    p_items: items,
    p_evidence_path: path,
  });
  const result = data as { ok: boolean; error_code: string | null; submission_id: string | null } | null;
  if (error || !result?.ok || !result.submission_id) {
    throw new Error(`e2e: submit_result failed: ${error?.message ?? result?.error_code}`);
  }
  return result.submission_id;
}

/** Ledger rows written for one submission (service role). */
export async function listLedgerForSubmission(
  submissionId: string,
): Promise<{ kind: string; points: number; carbon_kg: number | string; created_by: string | null }[]> {
  const { data, error } = await admin()
    .from("ledger_entries")
    .select("kind, points, carbon_kg, created_by")
    .eq("ref_submission_id", submissionId);
  if (error) throw new Error(`e2e: list ledger failed: ${error.message}`);
  return (data ?? []) as { kind: string; points: number; carbon_kg: number | string; created_by: string | null }[];
}

/** id of a waste category by its (unique) name, e.g. 'พลาสติก' (0003). */
export async function wasteCategoryId(name: string): Promise<string> {
  const { data, error } = await admin().from("waste_categories").select("id").eq("name", name).single();
  if (error || !data) throw new Error(`e2e: waste category ${name} not found: ${error?.message}`);
  return (data as { id: string }).id;
}

/** Current rates of a waste category by name (service role). */
export async function wasteRates(name: string): Promise<{ pointsPerKg: number; carbonKgPerKg: number }> {
  const { data, error } = await admin()
    .from("waste_categories")
    .select("points_per_kg, carbon_kg_per_kg")
    .eq("name", name)
    .single();
  if (error || !data) throw new Error(`e2e: rates of ${name} not found: ${error?.message}`);
  const row = data as { points_per_kg: number; carbon_kg_per_kg: number | string };
  return { pointsPerKg: row.points_per_kg, carbonKgPerKg: Number(row.carbon_kg_per_kg) };
}

// Rewards and cart (Task 12) ---------------------------------------------------------------

type RewardRow = { id: string; name: string; points_cost: number; stock: number; active: boolean; image_path: string | null };

/** A reward row created through the service role. Returns its id. */
export async function createRewardRow(name: string, pointsCost: number, stock: number, active = true): Promise<string> {
  const { data, error } = await admin()
    .from("rewards")
    .insert({ name, points_cost: pointsCost, stock, active })
    .select("id")
    .single();
  if (error || !data) throw new Error(`e2e: create reward failed: ${error?.message}`);
  return (data as { id: string }).id;
}

export async function setRewardActive(id: string, active: boolean): Promise<void> {
  const { error } = await admin().from("rewards").update({ active }).eq("id", id);
  if (error) throw new Error(`e2e: set reward active failed: ${error.message}`);
}

/** A reward by exact name (service role), or null. */
export async function findReward(name: string): Promise<RewardRow | null> {
  const { data, error } = await admin()
    .from("rewards")
    .select("id, name, points_cost, stock, active, image_path")
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`e2e: find reward failed: ${error.message}`);
  return data as RewardRow | null;
}

/** Remove rewards by name with their images (cart rows cascade, 0001). */
export async function deleteRewardsByName(names: string[]): Promise<void> {
  for (const name of names) {
    const { data } = await admin().from("rewards").select("id, image_path").eq("name", name);
    for (const row of (data ?? []) as { id: string; image_path: string | null }[]) {
      if (row.image_path) await admin().storage.from("reward-images").remove([row.image_path]);
    }
    const { error } = await admin().from("rewards").delete().eq("name", name);
    if (error) console.warn(`e2e cleanup: delete reward "${name}" failed: ${error.message}`);
  }
}

/** Give a student points through an 'adjust' ledger row (service role). */
export async function grantPoints(studentId: string, points: number): Promise<void> {
  const { error } = await admin().from("ledger_entries").insert({ student_id: studentId, kind: "adjust", points, note: "e2e" });
  if (error) throw new Error(`e2e: grant points failed: ${error.message}`);
}

/** Cart rows of one student (service role). */
export async function listCart(studentId: string): Promise<{ reward_id: string; qty: number }[]> {
  const { data, error } = await admin().from("cart_items").select("reward_id, qty").eq("student_id", studentId);
  if (error) throw new Error(`e2e: list cart failed: ${error.message}`);
  return (data ?? []) as { reward_id: string; qty: number }[];
}

export async function setRewardStock(id: string, stock: number): Promise<void> {
  const { error } = await admin().from("rewards").update({ stock }).eq("id", id);
  if (error) throw new Error(`e2e: set reward stock failed: ${error.message}`);
}

/** An order with one line for a reward, so the reward can no longer be deleted (order_items RESTRICT). */
export async function createOrderFor(studentId: string, rewardId: string, qty: number, unitCost: number): Promise<void> {
  const { data, error } = await admin()
    .from("orders")
    .insert({ student_id: studentId, total_points: qty * unitCost })
    .select("id")
    .single();
  if (error || !data) throw new Error(`e2e: create order failed: ${error?.message}`);
  const { error: itemError } = await admin()
    .from("order_items")
    .insert({ order_id: (data as { id: string }).id, reward_id: rewardId, qty, unit_cost: unitCost });
  if (itemError) throw new Error(`e2e: create order item failed: ${itemError.message}`);
}

// Checkout and orders (Task 13) -------------------------------------------------------------

/**
 * Give a student points through the real earn path: a joined fixed activity worth `points`,
 * a submission, and a staff approval. Returns the activity title (for cleanup).
 */
export async function seedApprovedEarn(student: TestUser, staff: TestUser, points: number, title: string): Promise<void> {
  const activityId = await createJoinedCodeActivity(title, student.id, { unit_points: points, requires_code: false });
  const submissionId = await seedSubmission(student, activityId, PNG_1X1);
  const c = await signedInClient(staff);
  const { error } = await c.rpc("approve_submission", { p_submission_id: submissionId });
  if (error) throw new Error(`e2e: approve failed: ${error.message}`);
}

/** Points balance of a student: the sum of every ledger row (service role). */
export async function ledgerBalance(studentId: string): Promise<number> {
  const { data, error } = await admin().from("ledger_entries").select("points").eq("student_id", studentId);
  if (error) throw new Error(`e2e: ledger balance failed: ${error.message}`);
  return ((data ?? []) as { points: number }[]).reduce((sum, r) => sum + r.points, 0);
}

export type OrderRow = { id: string; status: string; total_points: number };

/** Orders of one student, oldest first (service role). */
export async function listOrders(studentId: string): Promise<OrderRow[]> {
  const { data, error } = await admin()
    .from("orders")
    .select("id, status, total_points")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`e2e: list orders failed: ${error.message}`);
  return (data ?? []) as OrderRow[];
}

/** Move an order's expires_at into the past so it is due for expiry. */
export async function makeOrderDue(orderId: string): Promise<void> {
  const { error } = await admin()
    .from("orders")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(`e2e: make order due failed: ${error.message}`);
}

/** Put `qty` of a reward in the student's cart and check out through the student's own client. */
export async function checkoutAs(student: TestUser, rewardId: string, qty: number): Promise<string> {
  const c = await signedInClient(student);
  const { error: cartError } = await c.from("cart_items").insert({ student_id: student.id, reward_id: rewardId, qty });
  if (cartError) throw new Error(`e2e: cart insert failed: ${cartError.message}`);
  const { data, error } = await c.rpc("checkout");
  const result = data as { ok: boolean; order_id: string | null; error_code: string | null } | null;
  if (error || !result?.ok || !result.order_id) throw new Error(`e2e: checkout failed: ${error?.message ?? result?.error_code}`);
  return result.order_id;
}
