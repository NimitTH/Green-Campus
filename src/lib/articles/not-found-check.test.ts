import { describe, expect, it, vi } from "vitest";
import { articleSlugFromPath, createPublishedArticleCheck, type PublishedLookup } from "./not-found-check";

describe("articleSlugFromPath", () => {
  it("returns the slug of /articles/<slug> only", () => {
    expect(articleSlugFromPath("/articles/hello-world")).toBe("hello-world");
    expect(articleSlugFromPath("/articles/hello-world/")).toBe("hello-world");
    expect(articleSlugFromPath("/articles/%E0%B8%81")).toBe("ก");
    expect(articleSlugFromPath("/articles")).toBeNull();
    expect(articleSlugFromPath("/articles/")).toBeNull();
    expect(articleSlugFromPath("/articles/a/b")).toBeNull();
    expect(articleSlugFromPath("/staff/articles/x")).toBeNull();
    expect(articleSlugFromPath("/article-not-found")).toBeNull();
  });

  it("gives an empty slug for undecodable input", () => {
    expect(articleSlugFromPath("/articles/%E0%A4%A")).toBe("");
  });
});

describe("createPublishedArticleCheck (R145 cache)", () => {
  const setup = (lookupImpl: PublishedLookup, extra: { maxEntries?: number; timeoutMs?: number } = {}) => {
    let t = 1_000_000;
    const lookup = vi.fn(lookupImpl);
    const check = createPublishedArticleCheck({ lookup, now: () => t, positiveTtlMs: 60_000, negativeTtlMs: 10_000, ...extra });
    return { check, lookup, advance: (ms: number) => (t += ms) };
  };

  it("rejects malformed slugs without a lookup and without caching", async () => {
    const { check, lookup } = setup(async () => true);
    for (const slug of ["", "Bad Slug", "ก", "-x", "a--b", "x".repeat(81)]) expect(await check(slug)).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("caches a published slug for 60 s (hit), then looks it up again", async () => {
    const { check, lookup, advance } = setup(async () => true);
    expect(await check("a")).toBe(true);
    advance(59_999);
    expect(await check("a")).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(1);
    advance(2);
    expect(await check("a")).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("caches a missing slug for only 10 s", async () => {
    let published = false;
    const { check, lookup, advance } = setup(async () => published);
    expect(await check("new-post")).toBe(false);
    published = true; // the teacher publishes it
    advance(9_000);
    expect(await check("new-post")).toBe(false); // still the cached negative
    advance(1_001);
    expect(await check("new-post")).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest entry beyond maxEntries", async () => {
    const { check, lookup } = setup(async () => true, { maxEntries: 2 });
    await check("a");
    await check("b");
    await check("c"); // evicts a
    expect(lookup).toHaveBeenCalledTimes(3);
    await check("b");
    await check("c");
    expect(lookup).toHaveBeenCalledTimes(3); // still cached
    await check("a");
    expect(lookup).toHaveBeenCalledTimes(4); // was evicted
  });

  it("fails open on a timeout, aborts the lookup, and does not cache it", async () => {
    let aborted = false;
    const { check, lookup } = setup(
      (_slug, signal) =>
        new Promise<boolean>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(signal.reason);
          });
        }),
      { timeoutMs: 20 },
    );
    expect(await check("slow")).toBeNull();
    expect(aborted).toBe(true);
    expect(await check("slow")).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(2); // not cached
  });

  it("a shared store can be cleared (article writes): the next check looks up again", async () => {
    const store = new Map<string, { published: boolean; expires: number }>();
    let published = false;
    const lookup = vi.fn<PublishedLookup>(async () => published);
    const check = createPublishedArticleCheck({ lookup, store, now: () => 0 });
    expect(await check("post")).toBe(false);
    published = true; // published by a teacher
    expect(await check("post")).toBe(false); // cached
    store.clear(); // what clearArticleCheckCache() does after the write
    expect(await check("post")).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("fails open on an error and does not cache it", async () => {
    let fail = true;
    const { check, lookup } = setup(async () => {
      if (fail) throw new Error("db down");
      return true;
    });
    expect(await check("a")).toBeNull();
    fail = false;
    expect(await check("a")).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
