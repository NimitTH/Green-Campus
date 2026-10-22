import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SERVER_FETCH_TIMEOUT_MS, fetchWithTimeout } from "./fetch-timeout";

export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      // M1: see fetch-timeout.ts for the budget.
      global: { fetch: fetchWithTimeout(SERVER_FETCH_TIMEOUT_MS) },
    },
  );
}
