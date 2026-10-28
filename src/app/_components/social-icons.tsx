import type { SocialPlatform } from "./social-links";

const PATHS: Record<SocialPlatform, React.ReactNode> = {
  facebook: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z" />,
  youtube: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3.5" />
      <path d="M10.5 9.5v5l4.5-2.5z" />
    </>
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="16.8" cy="7.2" r="0.6" />
    </>
  ),
  x: <path d="M5 5l14 14M19 5L5 19" />,
  line: (
    <>
      <path d="M12 4c4.4 0 8 2.8 8 6.3 0 3.4-3.2 5.6-6.4 6.7-1 .3-1 .5-.5 1.7L12 20l-3-2.4C6 16.4 4 13.5 4 10.3 4 6.8 7.600 4 12 4z" />
    </>
  ),
};

/** Decorative glyph: the surrounding link carries the accessible name. */
export function SocialIcon({ platform }: { platform: SocialPlatform }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[platform]}
    </svg>
  );
}
