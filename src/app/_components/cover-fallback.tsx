// Stand-in for a missing cover image (DESIGN-4 5.2): a tinted box per type with a line icon. Decorative
// (aria-hidden); the card around it already carries the title and type as text. Colors are the
// --cover-* tokens in globals.css (both themes, icon vs background >= 3:1).

export type CoverKind = "waste" | "trees" | "fixed" | "article";

const ICON_PATH: Record<CoverKind, string> = {
  waste: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  trees: "M12 21v-6M12 3l-6 8h3l-3 4h12l-3-4h3z",
  fixed: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  article: "M6 3h9l3 3v15H6zM15 3v3h3M9 11h6M9 15h6M9 18h4",
};

const TINT: Record<CoverKind, string> = {
  waste: "bg-cover-waste text-cover-waste-ink",
  trees: "bg-cover-trees text-cover-trees-ink",
  fixed: "bg-cover-fixed text-cover-fixed-ink",
  article: "bg-cover-article text-cover-article-ink",
};

/** Activity type to cover kind; an unknown type reads as waste. */
export function coverKindForActivity(type: string): "waste" | "trees" | "fixed" {
  return type === "trees" || type === "fixed" ? type : "waste";
}

export function CoverFallback({ kind, className }: { kind: CoverKind; className?: string }) {
  return (
    <div
      data-cover-fallback={kind}
      aria-hidden="true"
      className={["grid place-items-center", TINT[kind], className].filter(Boolean).join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[min(46px,45%)] min-h-6 min-w-6"
      >
        <path d={ICON_PATH[kind]} />
      </svg>
    </div>
  );
}
