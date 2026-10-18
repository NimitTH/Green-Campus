import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Test-only admin access to the LOCAL Supabase stack (service key from .env.local).
// Never print the keys. Always refuses non-local Supabase URLs.

export type Role = "student" | "teacher" | "admin";
export type TestUser = { id: string; email: string; password: string; role: Role };

let client: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (client) return client;
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("e2e: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  }
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`e2e: refusing to create test users on non-local Supabase (${host})`);
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

/** Remove activities created by a test (participations cascade, 0004). */
export async function deleteActivitiesByTitle(title: string): Promise<void> {
  const { error } = await admin().from("activities").delete().eq("title", title);
  if (error) console.warn(`e2e cleanup: delete activity "${title}" failed: ${error.message}`);
}

/** An open, code-requiring activity (started 1 h ago, ends in 1 day) the student has already joined. */
export async function createJoinedCodeActivity(title: string, studentId: string): Promise<string> {
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
