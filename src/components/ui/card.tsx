type Deco = "tape" | "clip" | "pin";

// Notebook decorations (DESIGN-2 s2). Pure CSS shapes; never interactive, hidden from assistive tech.
const DECO: Record<Deco, string> = {
  tape: "-top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-2 bg-sun/60 shadow-card",
  clip: "-top-3 right-6 h-8 w-3 rounded-full border-2 border-rule-strong",
  pin: "-top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-danger shadow-card",
};

export function Card({
  as: Tag = "div",
  tone = "default",
  flush = false,
  deco,
  tilt = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "li";
  tone?: "default" | "accent";
  flush?: boolean;
  deco?: Deco;
  tilt?: boolean;
}) {
  const base = "rounded-card border border-rule text-ink shadow-sheet";
  const pad = flush ? "" : "p-4 md:p-6";
  const bg = tone === "accent" ? "bg-accent-soft" : "bg-surface";
  const tiltCls = tilt
    ? "-rotate-1 transition-transform duration-[400ms] ease-[var(--ease-out)] even:rotate-1 hover:rotate-0 motion-reduce:rotate-0 motion-reduce:transition-none"
    : "";
  const pos = deco ? "relative" : "";
  return (
    <Tag {...props} className={[base, pad, bg, pos, tiltCls, className].filter(Boolean).join(" ")}>
      {deco ? (
        <span data-deco aria-hidden="true" className={`pointer-events-none absolute ${DECO[deco]}`} />
      ) : null}
      {children}
    </Tag>
  );
}
