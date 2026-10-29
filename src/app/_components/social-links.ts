export type SocialPlatform = "facebook" | "youtube" | "instagram" | "x" | "line";

export type SocialLink = { platform: SocialPlatform; label: string; href: string };

// href is "/" until the owner supplies the real account URLs (DESIGN-3 3.4): change them here, in this file only.
// A blank href hides that platform.
export const SOCIAL_LINKS: readonly SocialLink[] = [
  { platform: "facebook", label: "Facebook", href: "/" },
  { platform: "youtube", label: "YouTube", href: "/" },
  { platform: "instagram", label: "Instagram", href: "/" },
  { platform: "x", label: "X", href: "/" },
  { platform: "line", label: "LINE", href: "/" },
];

export function visibleSocialLinks(links: readonly SocialLink[] = SOCIAL_LINKS): SocialLink[] {
  return links.filter((l) => l.href.trim() !== "");
}
