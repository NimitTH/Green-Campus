import { createAnonClient } from "@/lib/supabase/anon";
import { isValidSlug } from "./format";

// Prod-only bug found by the production e2e run (I7): /articles/[slug] is partially prerendered, so in
// `next start` its static shell streams first and an unknown slug answered 200 (not-found UI + noindex)
// instead of 404. The Next docs' fix: check the slug in Proxy before rendering and rewrite to a route that
// is a static 404. This module is that check: one indexed HEAD count, no content, behind a small cache.
//
// R145: Proxy cannot tell prefetches apart (Next strips next-router-prefetch / rsc from request.headers in
// Proxy, docs 03-file-conventions/proxy.md "RSC requests and rewrites"), so every /articles/<slug> prefetch
// and navigation reaches this check. Hence a per-instance TTL cache and a short timeout:
//   - published = true is cached 60 s, published = false only 10 s; a failed or timed-out lookup (1.5 s) is
//     not cached and fails open (null: the page renders as before).
//   - Every article write (src/app/actions/articles.ts, next to updateTag) calls clearArticleCheckCache().
//     The store lives on globalThis, so where Proxy runs in the same Node process as the server actions
//     (next dev, next start) a publish / unpublish / delete is seen on the very next request.
//   - Where Proxy runs in a separate instance (e.g. Vercel), the clear does not reach it; the TTLs bound the
//     staleness: a just-published article can 404 for at most 10 s; after an unpublish / delete, for at most
//     60 s the request passes Proxy and the page itself (its loader is invalidated at once by updateTag)
//     renders the not-found UI with status 200 + noindex instead of 404 (no content is shown).
// The cache is bounded (500 slugs, oldest evicted first). Malformed slugs are rejected without a lookup and
// never cached.

/** Where Proxy rewrites a missing article (src/app/(public)/article-not-found). */
export const ARTICLE_NOT_FOUND_PATH = "/article-not-found";

const ARTICLE_PATH = /^\/articles\/([^/]+)\/?$/;

/** The slug of an /articles/<slug> path (decoded), "" for an undecodable one, null for any other path. */
export function articleSlugFromPath(pathname: string): string | null {
  const m = ARTICLE_PATH.exec(pathname);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return "";
  }
}

/** Raw lookup: is the slug a published article? Throws on any failure (the caller decides). */
export type PublishedLookup = (slug: string, signal: AbortSignal) => Promise<boolean>;

export type PublishedCheckOptions = {
  lookup: PublishedLookup;
  positiveTtlMs?: number;
  negativeTtlMs?: number;
  maxEntries?: number;
  timeoutMs?: number;
  now?: () => number;
  /** The cache map (default: a fresh one; Proxy's check uses the process-wide store). */
  store?: Map<string, { published: boolean; expires: number }>;
};

export const ARTICLE_CHECK_DEFAULTS = { positiveTtlMs: 60_000, negativeTtlMs: 10_000, maxEntries: 500, timeoutMs: 1_500 } as const;

/**
 * A cached, time-limited published-article check. Returns true / false, or null when the lookup failed or
 * timed out (never cached).
 */
export function createPublishedArticleCheck(options: PublishedCheckOptions): (slug: string) => Promise<boolean | null> {
  const { lookup, now = Date.now } = options;
  const positiveTtlMs = options.positiveTtlMs ?? ARTICLE_CHECK_DEFAULTS.positiveTtlMs;
  const negativeTtlMs = options.negativeTtlMs ?? ARTICLE_CHECK_DEFAULTS.negativeTtlMs;
  const maxEntries = options.maxEntries ?? ARTICLE_CHECK_DEFAULTS.maxEntries;
  const timeoutMs = options.timeoutMs ?? ARTICLE_CHECK_DEFAULTS.timeoutMs;
  // Map keeps insertion order: the first key is the oldest entry.
  const cache = options.store ?? new Map<string, { published: boolean; expires: number }>();

  const remember = (slug: string, published: boolean) => {
    cache.delete(slug);
    cache.set(slug, { published, expires: now() + (published ? positiveTtlMs : negativeTtlMs) });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value as string);
  };

  return async (slug) => {
    const hit = cache.get(slug);
    if (hit && hit.expires > now()) return hit.published;
    if (hit) cache.delete(slug);
    // malformed: no lookup and not cached (junk URLs must not evict real entries)
    if (!isValidSlug(slug)) return false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort(new Error("article check timed out"));
        resolve(null);
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([lookup(slug, controller.signal), timedOut]);
      if (result === null) return null; // timed out: fail open, not cached
      remember(slug, result);
      return result;
    } catch {
      return null; // error: fail open, not cached
    } finally {
      clearTimeout(timer);
    }
  };
}

/** The real lookup: anon HEAD count on published articles (RLS returns published rows only to anon). */
const supabaseLookup: PublishedLookup = async (slug, signal) => {
  const { count, error } = await createAnonClient()
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug)
    .eq("published", true)
    .abortSignal(signal);
  if (error || count === null) throw new Error(`article check: ${error?.message ?? "no count"}`);
  return count > 0;
};

// One store per process, shared by the Proxy bundle and the server-action bundle (separate module instances).
const STORE_KEY = Symbol.for("green-campus.article-check-cache");
const globalStore = globalThis as typeof globalThis & { [STORE_KEY]?: Map<string, { published: boolean; expires: number }> };
const sharedStore = (globalStore[STORE_KEY] ??= new Map());

/** Proxy's check. true / false, or null = unknown (fail open). */
export const isPublishedArticle = createPublishedArticleCheck({ lookup: supabaseLookup, store: sharedStore });

/** Forget every cached slug (after any article write: a slug can change on edit). */
export function clearArticleCheckCache(): void {
  sharedStore.clear();
}
