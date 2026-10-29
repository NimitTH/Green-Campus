import type { NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/auth/callback-handler";

// Email-change confirmation link -> /profile?email=changed (failure -> /profile?email=link-error).
export async function GET(request: NextRequest) {
  return handleAuthCallback(request, "email");
}
