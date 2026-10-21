import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { ARTICLE_BUCKET } from "./format";

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
  updatedAt: string;
};

type Row = { id: string; slug: string; title: string; body: string; published: boolean; cover_path: string | null; updated_at: string };

const COLUMNS = "id, slug, title, body, published, cover_path, updated_at";

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
    updatedAt: r.updated_at,
  }));
}

/** Every article, drafts included, most recently edited first. */
export async function listArticlesForStaff(): Promise<StaffArticle[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error(`listArticlesForStaff: ${error.message}`);
  return toArticles((data ?? []) as Row[]);
}

export async function getArticleForStaff(id: string): Promise<StaffArticle | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("articles").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getArticleForStaff: ${error.message}`);
  if (!data) return null;
  return (await toArticles([data as Row]))[0];
}
