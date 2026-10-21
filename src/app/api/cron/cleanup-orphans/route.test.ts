import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const runCleanup = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/storage/orphans", () => ({ runCleanup: (...a: unknown[]) => runCleanup(...a) }));

import { NextRequest } from "next/server";
import { GET } from "./route";

const req = (auth?: string, qs = "") =>
  new NextRequest(`http://localhost/api/cron/cleanup-orphans${qs}`, { headers: auth ? { authorization: auth } : {} });
const RESULT = { deleted: 2, byBucket: { evidence: 1, "reward-images": 1, "article-images": 0 }, scanned: 5, dryRun: false, capped: false };

describe("GET /api/cron/cleanup-orphans", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    runCleanup.mockReset().mockResolvedValue(RESULT);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("401 without header", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(runCleanup).not.toHaveBeenCalled();
  });
  it("401 with wrong secret (same and different length)", async () => {
    expect((await GET(req("Bearer test-secreX"))).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(runCleanup).not.toHaveBeenCalled();
  });
  it("500 cron_not_configured when the secret is unset or empty, never runs", async () => {
    for (const v of ["", undefined]) {
      vi.stubEnv("CRON_SECRET", v as string);
      if (v === undefined) delete process.env.CRON_SECRET;
      const res = await GET(req("Bearer "));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "cron_not_configured" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(runCleanup).not.toHaveBeenCalled();
  });
  it("200 with the valid secret", async () => {
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULT);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(runCleanup).toHaveBeenCalledWith(expect.anything(), { dryRun: false });
  });
  it("?dry=1 passes dryRun", async () => {
    await GET(req("Bearer test-secret", "?dry=1"));
    expect(runCleanup).toHaveBeenCalledWith(expect.anything(), { dryRun: true });
  });
  it("500 cleanup_failed on error, without leaking details", async () => {
    runCleanup.mockRejectedValue(new Error("secret path"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "cleanup_failed" });
  });
});
