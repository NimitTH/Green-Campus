// Pure helpers for articles (Task 18 Part B, R122): slug rules, the plain-text body (paragraphs split on
// blank lines, rendered as text, never as HTML), list excerpts and the staff form validation.
// The database checks the same slug / title / body rules (0020).

export const ARTICLE_LIMITS = { titleMax: 200, slugMax: 80, bodyMax: 20_000, excerptMax: 160 } as const;

export const ARTICLE_BUCKET = "article-images";

/** Unique-constraint violation on articles.slug (agreed wording). */
export const SLUG_TAKEN_TH = "slug นี้ถูกใช้แล้ว";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

export function isValidSlug(slug: string): boolean {
  return slug.length <= ARTICLE_LIMITS.slugMax && SLUG_RE.test(slug);
}

/** A random integer in [0, 36). crypto.getRandomValues when available (rejection sampling, no bias). */
function randomBase36Index(): number {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.getRandomValues === "function") {
    const byte = new Uint8Array(1);
    // 252 = 7 * 36: accept 0..251 so every digit is equally likely
    do c.getRandomValues(byte);
    while (byte[0] >= 252);
    return byte[0] % 36;
  }
  return Math.floor(Math.random() * 36);
}

/** 'a-' + 8 base36 characters, for an article saved with a blank slug. */
export function generateSlug(random: () => number = randomBase36Index): string {
  let out = "a-";
  for (let i = 0; i < 8; i++) out += BASE36[Math.abs(Math.trunc(random())) % 36];
  return out;
}

/** Paragraphs of a plain-text body: split on blank (or whitespace-only) lines, trimmed, empties dropped. */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n[^\S\n]*\n\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** A one-line preview for the article list. */
export function excerpt(body: string, max: number = ARTICLE_LIMITS.excerptMax): string {
  const text = body.replace(/\s+/g, " ").trim();
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, max).join("").trimEnd()}…`;
}

export type ArticleInput = { title: string; slug: string; body: string; published: boolean };
export type ArticleFieldErrors = Partial<Record<keyof ArticleInput, string>>;
/** slug null: generate one on save. */
export type ArticleRecord = { title: string; slug: string | null; body: string; published: boolean };

export function isArticleInputShape(value: unknown): value is ArticleInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === "string" && typeof v.slug === "string" && typeof v.body === "string" && typeof v.published === "boolean";
}

export function validateArticle(
  input: ArticleInput,
): { ok: true; value: ArticleRecord } | { ok: false; fieldErrors: ArticleFieldErrors } {
  const errors: ArticleFieldErrors = {};

  const title = input.title.replace(/\s+/g, " ").trim();
  if (!title) errors.title = "กรอกชื่อบทความ";
  else if (Array.from(title).length > ARTICLE_LIMITS.titleMax) errors.title = `ชื่อบทความยาวได้ไม่เกิน ${ARTICLE_LIMITS.titleMax} ตัวอักษร`;

  const slugText = input.slug.trim().toLowerCase();
  if (slugText && !isValidSlug(slugText)) {
    errors.slug = `slug ใช้ได้เฉพาะ a-z, 0-9 และขีด (-) คั่นคำ ยาวไม่เกิน ${ARTICLE_LIMITS.slugMax} ตัว หรือเว้นว่างให้ระบบสร้างให้`;
  }

  const body = input.body.replace(/\r\n?/g, "\n").trim();
  if (!body) errors.body = "กรอกเนื้อหาบทความ";
  else if (Array.from(body).length > ARTICLE_LIMITS.bodyMax) errors.body = `เนื้อหายาวได้ไม่เกิน ${ARTICLE_LIMITS.bodyMax.toLocaleString("th-TH")} ตัวอักษร`;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { title, slug: slugText || null, body, published: input.published } };
}
