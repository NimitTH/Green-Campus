import { cacheLife, cacheTag } from "next/cache";
import { PAGE_SIZE, type ListParams } from "@/app/_components/list/list-params";
import { quoteOrValue, toIlikePattern } from "@/app/_components/list/search-escape";
import { getStaffNames } from "@/lib/staff-names";
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
  /** Teacher/admin display name from staff_names(); null when there is no author or it is not staff. */
  authorName: string | null;
};

export type PublicArticleListItem = PublicArticleSummary & { authorName: string | null };

type Row = { id: string; slug: string; title: string; body: string; cover_path: string | null; created_at: string; updated_at: string };
type PageRow = { id: string; slug: string; title: string; body: string; cover_path: string | null; created_at: string; author_id: string | null };

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

/**
 * One page (PAGE_SIZE) of published articles for /articles (DESIGN-3 5.1): optional title/body search
 * (matched literally, see search-escape.ts), newest or oldest first, with author names (one staff_names()
 * call per page). A page past the end returns no items with the real total, so the page can ask again for the
 * last page. Null on failure, cached only for seconds (same reason as listPublishedArticles).
 */
export async function listPublishedArticlesPage(
  p: Pick<ListParams, "q" | "sort" | "page">,
): Promise<{ items: PublicArticleListItem[]; total: number } | null> {
  "use cache";
  cacheTag(ARTICLES_TAG);
  const db = createAnonClient();
  const pattern = p.q ? quoteOrValue(toIlikePattern(p.q)) : null;
  const filtered = <T extends { or(filter: string): T }>(query: T): T => (pattern ? query.or(`title.ilike.${pattern},body.ilike.${pattern}`) : query);
  const ascending = p.sort === "old";
  const page = Math.max(1, Math.trunc(p.page) || 1);
  const { data, error, count } = await filtered(
    db.from("articles").select("id, slug, title, body, cover_path, created_at, author_id", { count: "exact" }).eq("published", true),
  )
    .order("created_at", { ascending })
    .order("id", { ascending })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (error?.code === "PGRST103") {
    // offset past the last row (HTTP 416): count only, so the caller can fall back to the last page
    const head = await filtered(db.from("articles").select("id", { count: "exact", head: true }).eq("published", true));
    if (head.error || head.count === null) {
      console.error("listPublishedArticlesPage failed");
      cacheLife("seconds");
      return null;
    }
    cacheLife("minutes");
    return { items: [], total: head.count };
  }
  if (error) {
    console.error("listPublishedArticlesPage failed");
    cacheLife("seconds");
    return null;
  }
  const rows = (data ?? []) as PageRow[];
  const names = await getStaffNames(rows.map((r) => r.author_id));
  cacheLife("minutes");
  return {
    total: count ?? rows.length,
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: excerpt(r.body),
      coverUrl: coverUrl(r.cover_path),
      createdAt: r.created_at,
      authorName: (r.author_id && names.get(r.author_id)) || null,
    })),
  };
}

/** One published article by slug; null when it is missing, unpublished or the slug is malformed. */
export async function getPublishedArticle(slug: string): Promise<PublicArticle | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ARTICLES_TAG);
  if (!isValidSlug(slug)) return null;
  const { data, error } = await createAnonClient()
    .from("articles")
    .select("id, slug, title, body, cover_path, created_at, updated_at, author_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(`getPublishedArticle: ${error.message}`);
  if (!data) return null;
  const r = data as Row & { author_id: string | null };
  const names = r.author_id ? await getStaffNames([r.author_id]) : new Map<string, string>();
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    body: r.body,
    coverUrl: coverUrl(r.cover_path),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorName: (r.author_id && names.get(r.author_id)) || null,
  };
}
