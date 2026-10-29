import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ANON_FETCH_TIMEOUT_MS, fetchWithTimeout } from "@/lib/supabase/fetch-timeout";
import { classifySignInResult, type PasswordCheck } from "./account-validation";

/**
 * "ok" when email + password sign in, "wrong" only for invalid credentials, "error" for anything else
 * (rate limit, timeout, 5xx). Uses a throwaway client with no cookies and no stored session, so the
 * caller's own session cookie is never touched. The password is never logged.
 */
export async function verifyPassword(email: string, password: string): Promise<PasswordCheck> {
  if (!email || !password) return "wrong";
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout(ANON_FETCH_TIMEOUT_MS) },
  });
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    const result = classifySignInResult(error);
    if (result === "ok" && !data.session) return "error";
    if (error) console.error("verifyPassword failed", error.code ?? error.status);
    if (result === "ok") await client.auth.signOut({ scope: "local" });
    return result;
  } catch {
    console.error("verifyPassword threw");
    return "error";
  }
}
