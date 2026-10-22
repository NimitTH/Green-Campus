import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ANON_FETCH_TIMEOUT_MS, fetchWithTimeout } from "./fetch-timeout";

/** Cookie-free client with the publishable key: for anonymous public data inside `use cache` scopes. */
export function createAnonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    // M1: a hanging Supabase fails these reads after 5 s instead of stalling next build or the cached pages.
    global: { fetch: fetchWithTimeout(ANON_FETCH_TIMEOUT_MS) },
  });
}
