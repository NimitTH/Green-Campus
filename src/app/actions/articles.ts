"use server";

import { revalidatePath, updateTag } from "next/cache";
import {
  ARTICLE_BUCKET,
  generateSlug,
  isArticleInputShape,
  SLUG_TAKEN_TH,
  validateArticle,
  type ArticleFieldErrors,
  type ArticleInput,
} from "@/lib/articles/format";
import { ARTICLES_TAG } from "@/lib/articles/public";
import { getCurrentUser } from "@/lib/auth/dal";
import { isAdminRole, isStaffRole } from "@/lib/auth/routes";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Server Actions are reachable by direct POST: every action checks the caller itself (DAL) and the
// database enforces the same rules again (articles RLS 0002, checks and storage policies 0020).
// Every successful write calls updateTag(ARTICLES_TAG) so the cached public pages show it at once.

const STAFF_ONLY = "เฉพาะครูและผู้ดูแลเท่านั้นที่จัดการบทความได้";
const ADMIN_ONLY = "เฉพาะผู้ดูแลระบบเท่านั้นที่ลบบทความได้ ครูยกเลิกการเผยแพร่แทนได้";
const NOT_FOUND = "ไม่พบบทความนี้ อาจถูกลบไปแล้ว";
const CHANGED = "บทความนี้ถูกแก้ไขไปแล้วระหว่างที่คุณแก้ กรุณาโหลดหน้าใหม่แล้วแก้อีกครั้ง";
const BAD_IMAGE = "รูปปกไม่ถูกต้อง กรุณาเลือกรูปใหม่แล้วบันทึกอีกครั้ง";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const COVER_PATH_RE = new RegExp(`^(${UUID})/${UUID}\\.jpg$`);
const GENERATED_SLUG_ATTEMPTS = 3;

export type SaveArticleInput = ArticleInput & {
  /** The article id. Create: chosen by the browser (it uploads the cover under it first). */
  id: string;
  mode: "create" | "update";
  /** Object path in article-images ({id}/{uuid}.jpg) when a new cover was uploaded. */
  imagePath?: string | null;
  /** Update: drop the current cover (ignored when imagePath is set). */
  removeCover?: boolean;
  /** Update: the updated_at the form was loaded with (optimistic concurrency). */
  loadedUpdatedAt?: string;
};

export type SaveArticleResult =
  | { ok: true; id: string; slug: string; error?: undefined; fieldErrors?: undefined }
  | { ok: false; id?: undefined; slug?: undefined; error?: string; fieldErrors?: ArticleFieldErrors };

export type ArticleActionResult = { ok: true; error?: undefined } | { ok: false; error: string };

function isSaveInput(value: unknown): value is SaveArticleInput {
  if (!isArticleInputShape(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  if (typeof v.id !== "string" || (v.mode !== "create" && v.mode !== "update")) return false;
  if (v.loadedUpdatedAt !== undefined && typeof v.loadedUpdatedAt !== "string") return false;
  if (v.removeCover !== undefined && typeof v.removeCover !== "boolean") return false;
  return v.imagePath === undefined || v.imagePath === null || typeof v.imagePath === "string";
}

function isSlugConflict(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" && /slug/i.test(error.message ?? "");
}

async function staffCaller() {
  const user = await getCurrentUser();
  return user && isStaffRole(user.role) ? user : null;
}

function revalidateArticles(id?: string) {
  updateTag(ARTICLES_TAG);
  revalidatePath("/staff/articles");
  if (id) revalidatePath(`/staff/articles/${id}/edit`);
}

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

async function removeCover(supabase: Supabase, path: string | null | undefined) {
  // Best effort: a leftover object is cleaned up by Task 19.
  if (path) await supabase.storage.from(ARTICLE_BUCKET).remove([path]).catch(() => undefined);
}

/** Create or update an article (staff). */
export async function saveArticle(input: SaveArticleInput): Promise<SaveArticleResult> {
  if (!isSaveInput(input)) return { ok: false, error: GENERIC_ERROR_TH };
  const user = await staffCaller();
  if (!user) return { ok: false, error: STAFF_ONLY };
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };

  const result = validateArticle(input);
  if (!result.ok) return { ok: false, fieldErrors: result.fieldErrors };
  const { title, slug, body, published } = result.value;

  const imagePath = input.imagePath ?? null;
  if (imagePath !== null) {
    const match = COVER_PATH_RE.exec(imagePath);
    if (!match || match[1] !== input.id.toLowerCase()) return { ok: false, error: BAD_IMAGE };
  }

  const supabase = await createServerClient();

  if (input.mode === "update") {
    if (!input.loadedUpdatedAt || Number.isNaN(Date.parse(input.loadedUpdatedAt))) return { ok: false, error: GENERIC_ERROR_TH };
    const { data: before } = await supabase.from("articles").select("cover_path").eq("id", input.id).maybeSingle();
    const previousCover = (before as { cover_path: string | null } | null)?.cover_path ?? null;
    const cover = imagePath ? { cover_path: imagePath } : input.removeCover ? { cover_path: null } : {};
    // A blank slug on edit keeps the current one (changing it would break shared links).
    const fields = { title, body, published, ...(slug ? { slug } : {}), ...cover };
    const { data, error } = await supabase
      .from("articles")
      .update(fields)
      .eq("id", input.id)
      .eq("updated_at", input.loadedUpdatedAt)
      .select("id, slug");
    if (error) {
      if (isSlugConflict(error)) return { ok: false, fieldErrors: { slug: SLUG_TAKEN_TH } };
      console.error("saveArticle update failed", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR_TH };
    }
    if (!data || data.length === 0) return { ok: false, error: before ? CHANGED : NOT_FOUND };
    if ("cover_path" in cover && previousCover && previousCover !== imagePath) await removeCover(supabase, previousCover);
    revalidateArticles(input.id);
    return { ok: true, id: input.id, slug: (data[0] as { slug: string }).slug };
  }

  // create: a typed slug that is taken is the user's to change; a generated one is retried
  const attempts = slug ? 1 : GENERATED_SLUG_ATTEMPTS;
  for (let i = 0; i < attempts; i++) {
    const useSlug = slug ?? generateSlug();
    const { error } = await supabase.from("articles").insert({
      id: input.id,
      title,
      slug: useSlug,
      body,
      published,
      cover_path: imagePath,
      author_id: user.id,
    });
    if (!error) {
      revalidateArticles();
      return { ok: true, id: input.id, slug: useSlug };
    }
    if (isSlugConflict(error)) {
      if (slug) return { ok: false, fieldErrors: { slug: SLUG_TAKEN_TH } };
      continue;
    }
    console.error("saveArticle insert failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  return { ok: false, error: GENERIC_ERROR_TH };
}

/** Publish or unpublish (staff), only while the row still has the updated_at the page showed. */
export async function setArticlePublished(
  articleId: string,
  published: boolean,
  loadedUpdatedAt: string,
): Promise<ArticleActionResult> {
  if (!isUuid(articleId) || typeof published !== "boolean") return { ok: false, error: NOT_FOUND };
  if (typeof loadedUpdatedAt !== "string" || Number.isNaN(Date.parse(loadedUpdatedAt))) return { ok: false, error: GENERIC_ERROR_TH };
  if (!(await staffCaller())) return { ok: false, error: STAFF_ONLY };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("articles")
    .update({ published })
    .eq("id", articleId)
    .eq("updated_at", loadedUpdatedAt)
    .select("id");
  if (error) {
    console.error("setArticlePublished failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  if (!data || data.length === 0) {
    const { data: still } = await supabase.from("articles").select("id").eq("id", articleId).maybeSingle();
    return { ok: false, error: still ? CHANGED : NOT_FOUND };
  }
  revalidateArticles(articleId);
  return { ok: true };
}

/** Delete an article and its cover (admin only, RLS 0002). */
export async function deleteArticle(articleId: string): Promise<ArticleActionResult> {
  if (!isUuid(articleId)) return { ok: false, error: NOT_FOUND };
  const user = await staffCaller();
  if (!user) return { ok: false, error: STAFF_ONLY };
  if (!isAdminRole(user.role)) return { ok: false, error: ADMIN_ONLY };

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("articles").delete().eq("id", articleId).select("id, cover_path");
  if (error) {
    console.error("deleteArticle failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };
  await removeCover(supabase, (data[0] as { cover_path: string | null }).cover_path);
  revalidateArticles();
  return { ok: true };
}
