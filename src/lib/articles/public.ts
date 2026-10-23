import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { ARTICLE_BUCKET, excerpt, isValidSlug } from "./format";

// Published articles for the public pages (/articles, /articles/[slug]; spec 9.1). Anonymous and
// cookie-free, so they are cached like the home page totals: the same public data for everyone. Every
// article write (src/app/actions/articles.ts) calls updateTag(ARTICLES_TAG), so a publish / unpublish /
// edit / delete is visible on the next request. RLS (0002) returns published rows only to anon; the
// `published` filter below says so explicitly. A failed load throws (failures are not cached).

export const ARTICLES_TAG = "articles";

export type PublicArticleSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  createdAt: string;
};

export type PublicArticle = {
  id: string;
  slug: string;
  title: string;
  body: string;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = { id: string; slug: string; title: string; body: string; cover_path: string | null; created_at: string; updated_at: string };

function coverUrl(path: string | null): string | null {
  return path ? createAnonClient().storage.from(ARTICLE_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

/**
 * Published articles, newest first (at most 100). Null on failure, cached only for seconds: a throw
 * inside "use cache" would fail the `next build` prerender of /articles when Supabase is unreachable.
 */
export async function listPublishedArticles(): Promise<PublicArticleSummary[] | null> {
  "use cache";
  cacheTag(ARTICLES_TAG);
  const { data, error } = await createAnonClient()
    .from("articles")
    .select("id, slug, title, body, cover_path, created_at, updated_at")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error) {
    console.error("listPublishedArticles failed");
    cacheLife("seconds");
    return null;
  }
  cacheLife("minutes");
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: excerpt(r.body),
    coverUrl: coverUrl(r.cover_path),
    createdAt: r.created_at,
  }));
}

/** One published article by slug; null when it is missing, unpublished or the slug is malformed. */
export async function getPublishedArticle(slug: string): Promise<PublicArticle | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ARTICLES_TAG);
  if (!isValidSlug(slug)) return null;
  const { data, error } = await createAnonClient()
    .from("articles")
    .select("id, slug, title, body, cover_path, created_at, updated_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(`getPublishedArticle: ${error.message}`);
  if (!data) return null;
  const r = data as Row;
  return { id: r.id, slug: r.slug, title: r.title, body: r.body, coverUrl: coverUrl(r.cover_path), createdAt: r.created_at, updatedAt: r.updated_at };
}
