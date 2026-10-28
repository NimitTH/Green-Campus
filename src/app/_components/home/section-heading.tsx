import type { ReactNode } from "react";

/** Page column of the home page (DESIGN-2 3.4): 70rem, 16px gutter on phones, 24px from md. */
export const HOME_CONTAINER = "mx-auto w-full max-w-[70rem] px-4 md:px-6";

/** Vertical rhythm shared by the numbered sections. */
export const HOME_SECTION = "py-16 md:py-20";

/**
 * Numbered notebook heading: "05 · กิจกรรม" with a ruled tail, then the h2. The h2 id is `home-<id>` so it
 * never collides with an id on another page kept alive by client navigation.
 */
export function SectionHeading({ id, num, kicker, title }: { id: string; num: string; kicker: string; title: ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-3 text-sm font-semibold text-accent">
        <span className="font-mono tracking-[0.12em]">{num}</span>
        <span aria-hidden="true">·</span>
        <span>{kicker}</span>
        <span data-deco aria-hidden="true" className="pointer-events-none h-px w-18 bg-accent" />
      </p>
      <h2
        id={`home-${id}`}
        className="mt-3 max-w-[20ch] font-display text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.22] font-bold tracking-[-0.015em] text-ink"
      >
        {title}
      </h2>
    </div>
  );
}
