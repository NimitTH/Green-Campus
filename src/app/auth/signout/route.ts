import { NextResponse, type NextRequest } from "next/server";
import { isCurrentSessionSuspended } from "@/lib/auth/dal";
import { createServerClient } from "@/lib/supabase/server";

// /auth/signout (DESIGN-4 6.4). requireUser sends a suspended account here (GET ?reason=suspended): sign the
// session out (cookies cleared on this response) and show the suspended message on /login.
//
// A GET can be triggered cross-site (a link or an <img>), so GET signs out only a session that really is
// suspended; anyone else is sent home untouched. POST always signs out, but only from this site (Origin).

const SUSPENDED_LOGIN = "/login?error=suspended";

function to(request: NextRequest, path: string): NextResponse {
  // 303: the browser follows with a GET whatever the original method was.
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

async function signOutTo(request: NextRequest, path: string): Promise<NextResponse> {
  const supabase = await createServerClient();
  // A refused remote sign-out (e.g. Auth already rejects a banned user) still clears the local session.
  const { error } = await supabase.auth.signOut();
  if (error) console.error("auth/signout failed", error.code, error.status);
  return to(request, path);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.searchParams.get("reason") !== "suspended") return to(request, "/");
  if (!(await isCurrentSessionSuspended())) return to(request, "/");
  return signOutTo(request, SUSPENDED_LOGIN);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const suspended = await isCurrentSessionSuspended();
  return signOutTo(request, suspended ? SUSPENDED_LOGIN : "/login");
}
