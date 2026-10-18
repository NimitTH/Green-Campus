import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
