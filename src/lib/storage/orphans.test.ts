import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_DELETIONS, REMOVE_BATCH, runCleanup, selectOrphans, type StoredObject } from "./orphans";

const NOW = new Date("2026-10-21T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const refs = (o: Partial<Record<string, string[]>> = {}) => ({
  evidence: new Set(o.evidence ?? []),
  "reward-images": new Set(o["reward-images"] ?? []),
  "article-images": new Set(o["article-images"] ?? []),
});
const obj = (bucket: string, name: string, h: number): StoredObject => ({ bucket, name, createdAt: ago(h) });

describe("selectOrphans", () => {
  it("keeps an old referenced object", () => {
    expect(selectOrphans([obj("evidence", "a/b/e.jpg", 100)], refs({ evidence: ["a/b/e.jpg"] }), NOW)).toEqual([]);
  });
  it("selects an orphan older than 24h", () => {
    expect(selectOrphans([obj("evidence", "a/b/e.jpg", 25)], refs(), NOW)).toEqual([{ bucket: "evidence", name: "a/b/e.jpg" }]);
  });
  it("keeps a 1h-old orphan", () => {
    expect(selectOrphans([obj("evidence", "x", 1)], refs(), NOW)).toEqual([]);
  });
  it("keeps an orphan of exactly 24h (strictly older only)", () => {
    expect(selectOrphans([obj("evidence", "x", 24)], refs(), NOW)).toEqual([]);
    expect(selectOrphans([{ bucket: "evidence", name: "x", createdAt: new Date(NOW.getTime() - 24 * 3_600_000 - 1) }], refs(), NOW)).toHaveLength(1);
  });
  it("ignores placeholders", () => {
    expect(selectOrphans([obj("evidence", ".emptyFolderPlaceholder", 99), obj("evidence", "a/.emptyFolderPlaceholder", 99)], refs(), NOW)).toEqual([]);
  });
  it("isolates buckets: a name referenced elsewhere does not protect it", () => {
    const r = selectOrphans([obj("reward-images", "same.jpg", 30)], refs({ evidence: ["same.jpg"], "article-images": ["same.jpg"] }), NOW);
    expect(r).toEqual([{ bucket: "reward-images", name: "same.jpg" }]);
  });
  it("never touches unknown buckets", () => {
    expect(selectOrphans([obj("avatars", "x", 99)], refs(), NOW)).toEqual([]);
  });
  it("skips invalid dates", () => {
    expect(selectOrphans([{ bucket: "evidence", name: "x", createdAt: new Date("nope") }], refs(), NOW)).toEqual([]);
  });
});

/** A fake client: one flat folder per bucket, `files` are old orphans; no rows referenced. */
function fakeClient(files: Record<string, string[]>, removeSpy = vi.fn()) {
  const created = ago(48).toISOString();
  return {
    removeSpy,
    client: {
      storage: {
        from: (bucket: string) => ({
          list: async (_prefix: string, opts: { limit: number; offset: number }) => ({
            data: (files[bucket] ?? []).slice(opts.offset, opts.offset + opts.limit).map((n) => ({ name: n, id: "id", created_at: created })),
            error: null,
          }),
          remove: async (names: string[]) => {
            removeSpy(bucket, names);
            return { data: names.map((name) => ({ name })), error: null };
          },
        }),
      },
      from: () => ({ select: () => ({ not: () => ({ range: async () => ({ data: [], error: null }) }) }) }),
    } as unknown as SupabaseClient,
  };
}
const names = (n: number) => Array.from({ length: n }, (_, i) => `f${i}.jpg`);

describe("runCleanup", () => {
  it("removes in batches of at most 100", async () => {
    const { client, removeSpy } = fakeClient({ evidence: names(250) });
    const r = await runCleanup(client, { dryRun: false, now: NOW });
    expect(r.deleted).toBe(250);
    expect(removeSpy.mock.calls.map((c) => c[1].length)).toEqual([REMOVE_BATCH, REMOVE_BATCH, 50]);
    expect(r.capped).toBe(false);
  });
  it("paginates listing past 1000 objects", async () => {
    const { client } = fakeClient({ evidence: names(1500) });
    const r = await runCleanup(client, { dryRun: true, now: NOW });
    expect(r.scanned).toBe(1500);
  });
  it("caps at 2000 deletions and reports capped", async () => {
    const { client, removeSpy } = fakeClient({ evidence: names(1500), "reward-images": names(1500) });
    const r = await runCleanup(client, { dryRun: false, now: NOW });
    expect(r.deleted).toBe(MAX_DELETIONS);
    expect(r.capped).toBe(true);
    expect(removeSpy.mock.calls.every((c) => c[1].length <= REMOVE_BATCH)).toBe(true);
  });
  it("dry run counts but deletes nothing", async () => {
    const { client, removeSpy } = fakeClient({ evidence: names(3) });
    const r = await runCleanup(client, { dryRun: true, now: NOW });
    expect(r).toMatchObject({ deleted: 3, dryRun: true, byBucket: { evidence: 3, "reward-images": 0, "article-images": 0 } });
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
