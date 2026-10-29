export const AVATAR_BUCKET = "avatars";

const LEADING_VOWELS = /^[เแโใไ]+/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const AVATAR_PATH = new RegExp(String.raw`^(${UUID})/${UUID}\.jpg$`);

/** First letter of a name for the picture-less avatar: skips Thai leading vowels, upper-cases Latin. "?" if empty. */
export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  const rest = trimmed.replace(LEADING_VOWELS, "") || trimmed;
  if (!rest) return "?";
  const first = new Intl.Segmenter("th", { granularity: "grapheme" }).segment(rest)[Symbol.iterator]().next().value;
  return first ? first.segment.toLocaleUpperCase("en") : "?";
}

/** `<userId>/<uuid>.jpg`, the only shape the bucket policy and profiles_avatar_path_format accept. */
export function isOwnAvatarPath(path: string, userId: string): boolean {
  const match = AVATAR_PATH.exec(path);
  return !!match && match[1] === userId;
}

/** Public URL of an object in the `avatars` bucket (the bucket is public). */
export function avatarPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}
