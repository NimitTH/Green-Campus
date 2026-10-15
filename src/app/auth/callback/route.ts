import type { NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/auth/callback-handler";

// Signup confirmation link -> /dashboard (failure -> /login?error=link).
export async function GET(request: NextRequest) {
  return handleAuthCallback(request, "signup");
}
