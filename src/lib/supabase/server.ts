import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SERVER_FETCH_TIMEOUT_MS, fetchWithTimeout } from "./fetch-timeout";

export async function createServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // M1: no request waits for a hanging Supabase forever (see fetch-timeout.ts for the budget).
      global: { fetch: fetchWithTimeout(SERVER_FETCH_TIMEOUT_MS) },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // Safe to ignore; session refresh happens in Server Actions/Route Handlers.
          }
        },
      },
    },
  );
}
