import { createAnonClient } from "@/lib/supabase/anon";
import { isValidSlug } from "./format";

// Prod-only bug found by the production e2e run (I7): /articles/[slug] is partially prerendered, so in
// `next start` its static shell streams first and an unknown slug answered 200 (not-found UI + noindex)
// instead of 404. The Next docs' fix: check the slug in Proxy before rendering and rewrite to a route that
// is a static 404. This module is that check: one indexed HEAD count, no content.

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

/**
 * true / false: the slug is / is not a published article. null: the lookup failed (Supabase down or slow);
 * the caller then lets the page render as before (fail open: the page shows its own not-found or error UI).
 */
export async function isPublishedArticle(slug: string): Promise<boolean | null> {
  if (!isValidSlug(slug)) return false;
  try {
    const { count, error } = await createAnonClient()
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug)
      .eq("published", true);
    if (error || count === null) return null;
    return count > 0;
  } catch {
    return null;
  }
}
