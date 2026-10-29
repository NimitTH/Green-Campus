import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { CALLBACK_TARGETS, EMAIL_PENDING_TARGET, isEmailChangePending, isRecoveryAmr, type CallbackFlow } from "./email-links";

// Email links (signup confirmation, password reset) land on /auth/callback[/reset] with
// ?code=... (PKCE). Exchange the code for a session cookie, then go to a fixed page.
export async function handleAuthCallback(
  request: NextRequest,
  flow: CallbackFlow,
): Promise<NextResponse> {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const targets = CALLBACK_TARGETS[flow];

  // Email change with two confirmations: a first link that arrives with a query message and no code
  // is progress, not a failure. (Local GoTrue puts the message in the URL fragment instead; the profile
  // page handles that case in the browser.)
  if (flow === "email" && isEmailChangePending(searchParams)) {
    return NextResponse.redirect(new URL(EMAIL_PENDING_TARGET, origin));
  }

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let success = targets.success;
      if (flow === "signup") {
        // A recovery link that reached the generic callback (root fallback) still goes to
        // the set-new-password page.
        const { data } = await supabase.auth.getClaims();
        if (isRecoveryAmr(data?.claims?.amr)) success = CALLBACK_TARGETS.reset.success;
      }
      return NextResponse.redirect(new URL(success, origin));
    }
  }

  return NextResponse.redirect(new URL(targets.failure, origin));
}
