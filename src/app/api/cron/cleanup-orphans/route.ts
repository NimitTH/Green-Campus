import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCleanup } from "@/lib/storage/orphans";

// GET /api/cron/cleanup-orphans (Task 19, R129-R132; spec 8.4): the daily Vercel Cron job that deletes
// images no row references and that are older than 24 hours, in the evidence, reward-images and
// article-images buckets. Service role, deletes through the Storage API. Default Node runtime.
// Fails closed without CRON_SECRET. Logs counts only, never paths or student ids.
// ?dry=1 reports what would be deleted without deleting.

// Orphan listing and batched removes can take a while; ask the platform for up to 60 s (route segment config,
// valid in route.ts with Cache Components: node_modules/next/dist/docs/.../02-route-segment-config/maxDuration.md).
// Hobby plan limits may still cap it lower; the 2000-per-run cap keeps a run short.
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return json(500, { error: "cron_not_configured" });
  if (!authorized(request.headers.get("authorization"), secret)) return json(401, { error: "unauthorized" });

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  try {
    const result = await runCleanup(createAdminClient(), { dryRun });
    console.info(`cleanup-orphans: scanned=${result.scanned} deleted=${result.deleted} dryRun=${dryRun} capped=${result.capped}`);
    return json(200, result);
  } catch (error) {
    // Stage code only (e.g. list_failed:evidence, recheck_failed, remove_failed); never the error message.
    const stage = typeof (error as { stage?: unknown })?.stage === "string" ? (error as { stage: string }).stage : "unexpected";
    console.error(`cleanup-orphans failed stage=${stage}`);
    return json(500, { error: "cleanup_failed" });
  }
}
