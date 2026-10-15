import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/routes";
import { createServerClient } from "@/lib/supabase/server";

// Email links (signup confirmation, password reset) land here with ?code=... (PKCE).
// Exchange the code for a session cookie, then continue to ?next=.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const failTo = next === "/reset-password" ? "/forgot-password" : "/login";
  const url = new URL(failTo, origin);
  url.searchParams.set("error", "link");
  return NextResponse.redirect(url);
}
