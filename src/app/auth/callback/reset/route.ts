import type { NextRequest } from "next/server";
import { handleAuthCallback } from "@/lib/auth/callback-handler";

// Password reset link -> /reset-password (failure -> /forgot-password?error=link).
export async function GET(request: NextRequest) {
  return handleAuthCallback(request, "reset");
}
