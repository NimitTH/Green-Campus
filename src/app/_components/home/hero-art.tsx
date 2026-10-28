// Hero picture (DESIGN-2 5.1): a taped polaroid of a globe growing a tree, a round stamp, a hand-drawn arrow
// and three falling leaves. Decoration only: hidden from assistive tech and never in the way of a tap.
const DECO = { "data-deco": true, "aria-hidden": true } as const;

const LEAVES = [
  { left: "20%", delay: "0s" },
  { left: "70%", delay: "3s" },
  { left: "45%", delay: "6s" },
];

export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <div {...DECO} className={`pointer-events-none relative aspect-[1/1.08] select-none ${className}`}>
      <span
        {...DECO}
        className="pointer-events-none absolute top-[2%] left-[38%] z-20 h-6 w-24 -rotate-[4deg] border border-dashed border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--accent-soft)_80%,transparent)]"
      />
      <div
        {...DECO}
        className="pointer-events-none absolute inset-[6%_4%_0_8%] rotate-3 border border-rule bg-surface p-3.5 pb-13 shadow-[2px_3px_0_var(--rule),16px_22px_34px_-10px_color-mix(in_oklab,var(--shadow-color)_var(--shadow-a-cast),transparent)]"
      >
        <svg viewBox="0 0 200 200" focusable="false" className="block size-full bg-[color-mix(in_oklab,var(--sea)_30%,var(--paper))]">
          <circle cx="100" cy="128" r="62" className="fill-sea" />
          <path
            d="M58 112c10-14 26-10 30 0s-6 18 4 26-2 22-16 18-26-16-24-28 0-10 6-16zM112 82c14-4 30 4 34 16s-8 12-4 22-10 14-18 8-4-16-14-20-10-22 2-26zM124 150c8-4 20 0 22 8s-10 14-18 10-10-14-4-18z"
            className="fill-accent"
            opacity=".85"
          />
          <path d="M100 66 C100 52 100 40 100 30" stroke="oklch(45% 0.07 60)" strokeWidth="6" strokeLinecap="round" />
          <path d="M100 44 C 88 38 82 30 84 20" stroke="oklch(45% 0.07 60)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="22" r="20" fill="oklch(65% 0.13 145)" />
          <circle cx="84" cy="30" r="14" fill="oklch(70% 0.12 145)" />
          <circle cx="116" cy="30" r="15" fill="oklch(60% 0.12 148)" />
          <circle cx="100" cy="10" r="11" fill="oklch(77% 0.12 135)" />
          <circle cx="160" cy="40" r="12" className="fill-sun" />
          <path d="M24 60 q8-6 16 0 q8 6 16 0" strokeWidth="2" fill="none" opacity=".5" className="stroke-muted" />
        </svg>
        <p className="absolute inset-x-0 bottom-3.5 text-center text-xs tracking-[0.06em] text-muted">
          บันทึกที่ 001 · โลกของเรา
        </p>
      </div>
      <div
        {...DECO}
        className="pointer-events-none absolute bottom-[10%] -left-[4%] z-30 grid size-24 -rotate-12 place-items-center rounded-full border-2 border-accent bg-[color-mix(in_oklab,var(--paper)_70%,transparent)] text-center font-mono text-[0.6875rem] leading-[1.3] tracking-[0.12em] text-accent"
      >
        <span>
          GREEN
          <b className="block text-lg">{"♻︎"}</b>
          CAMPUS
        </span>
      </div>
      <svg
        {...DECO}
        focusable="false"
        viewBox="0 0 90 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="pointer-events-none absolute -top-[2%] -right-[2%] z-30 w-22 text-accent"
      >
        <path d="M6 50 C 20 20, 50 10, 78 18" />
        <path d="M70 10 l9 8 -11 4" />
      </svg>
      {LEAVES.map((l) => (
        <span key={l.left} {...DECO} className="leaf-fall pointer-events-none" style={{ left: l.left, animationDelay: l.delay }} />
      ))}
    </div>
  );
}
