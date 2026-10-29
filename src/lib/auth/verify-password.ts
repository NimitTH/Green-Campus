import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ANON_FETCH_TIMEOUT_MS, fetchWithTimeout } from "@/lib/supabase/fetch-timeout";

/**
 * True when email + password sign in. Uses a throwaway client with no cookies and no stored session,
 * so the caller's own session cookie is never touched. The password is never logged.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout(ANON_FETCH_TIMEOUT_MS) },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await client.auth.signOut({ scope: "local" });
  return true;
}
