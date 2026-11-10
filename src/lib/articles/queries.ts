import "server-only";
import { pageSizeOf, type ListState } from "@/app/_components/list/list-params";
import { fetchPage } from "@/app/_components/list/paging";
import { createServerClient } from "@/lib/supabase/server";
import { ARTICLE_BUCKET, isArticleCategory, type ArticleCategory } from "./format";
import { STAFF_ARTICLE_CONFIG, STAFF_ARTICLE_SORT_COLUMN, staffArticleSearchFilter } from "./list-config";

// Read helpers for /staff/articles. They run as the signed-in user, so RLS decides what is visible
// (staff read every article, drafts included; 0002). Callers check the role via the DAL.

export type StaffArticle = {
  id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  coverPath: string | null;
  coverUrl: string | null;
  category: ArticleCategory;
  updatedAt: string;
};

type Row = { id: string; slug: string; title: string; body: string; published: boolean; cover_path: string | null; category: string; updated_at: string };

const COLUMNS = "id, slug, title, body, published, cover_path, category, updated_at";

async function toArticles(rows: Row[]): Promise<StaffArticle[]> {
  const supabase = await createServerClient();
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    body: r.body,
    published: r.published,
    coverPath: r.cover_path,
    coverUrl: r.cover_path ? supabase.storage.from(ARTICLE_BUCKET).getPublicUrl(r.cover_path).data.publicUrl : null,
    category: isArticleCategory(r.category) ? r.category : "other",
    updatedAt: r.updated_at,
  }));
}

type Filterable = { or(filter: string): Filterable; eq(column: string, value: string): Filterable };

/**
 * One page (pageSizeOf(STAFF_ARTICLE_CONFIG)) of /staff/articles, drafts included: optional title search (matched
 * literally) AND the category filter. Sorted by created_at or title (nulls last), then id. A page past the end returns
 * no items with the real total. Throws on failure.
 */
export async function listArticlesForStaffPage(
  p: Pick<ListState, "q" | "sort" | "dir" | "filters" | "page">,
): Promise<{ items: StaffArticle[]; total: number }> {
  const supabase = await createServerClient();
  const search = p.q ? staffArticleSearchFilter(p.q) : null;
  const category = p.filters.category;
  const categoryFilter = category && isArticleCategory(category) ? category : null;
  // the same builder comes back (each method returns `this`), so the cast back to T is exact
  const filtered = <T,>(query: T): T => {
    let q = query as unknown as Filterable;
    if (search) q = q.or(search);
    if (categoryFilter) q = q.eq("category", categoryFilter);
    return q as unknown as T;
  };
  const column = Object.hasOwn(STAFF_ARTICLE_SORT_COLUMN, p.sort) ? STAFF_ARTICLE_SORT_COLUMN[p.sort as keyof typeof STAFF_ARTICLE_SORT_COLUMN] : STAFF_ARTICLE_SORT_COLUMN.date;
  const ascending = p.dir === "asc";
  const { items, total } = await fetchPage<Row>("listArticlesForStaffPage", {
    page: p.page,
    size: pageSizeOf(STAFF_ARTICLE_CONFIG),
    run: (from, to) =>
      filtered(supabase.from("articles").select(COLUMNS, { count: "exact" }))
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .range(from, to),
    head: () => filtered(supabase.from("articles").select("id", { count: "exact", head: true })),
  });
  return { items: await toArticles(items), total };
}

export async function getArticleForStaff(id: string): Promise<StaffArticle | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("articles").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getArticleForStaff: ${error.message}`);
  if (!data) return null;
  return (await toArticles([data as Row]))[0];
}
