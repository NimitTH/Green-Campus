import { NextResponse, type NextRequest } from "next/server";
import { isSuspendedAt } from "@/lib/auth/dal";
import { OAUTH_NEXT_COOKIE, googleCallbackTarget } from "@/lib/auth/google";
import { createServerClient } from "@/lib/supabase/server";

// Sign in with Google (docs/superpowers/specs/2026-11-26-google-signin-design.md): Google -> Supabase -> here with
// ?code (PKCE). Exchange it for a session, then apply the same suspension rule as password sign-in (DESIGN-4 6.4):
// a suspended student is signed straight back out. Cancel at Google (?error=...) or a bad code -> /login?error=google.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  let exchanged = false;
  let suspended = false;

  if (code) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      exchanged = true;
      const { data: status } = await supabase
        .from("account_status")
        .select("suspended_until")
        .eq("student_id", data.user.id)
        .maybeSingle();
      suspended = isSuspendedAt((status as { suspended_until: string | null } | null)?.suspended_until ?? null, new Date());
      if (suspended) await supabase.auth.signOut();
    }
  }

  const response = NextResponse.redirect(new URL(googleCallbackTarget({ exchanged, suspended, next: readNext(request) }), origin));
  response.cookies.delete(OAUTH_NEXT_COOKIE);
  return response;
}

/** The ?next= the button kept, decoded; a malformed value counts as none (googleCallbackTarget checks the path). */
function readNext(request: NextRequest): string | undefined {
  const raw = request.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}
