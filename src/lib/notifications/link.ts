import { safeNextPath } from "@/lib/auth/routes";

/** The link if it is a same-site path (no "//", backslash, control characters or whitespace), else null. */
export function internalLink(link: string | null | undefined): string | null {
  const safe = safeNextPath(link, "");
  return safe === "" ? null : safe;
}
