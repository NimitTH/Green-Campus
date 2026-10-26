export function Card({
  as: Tag = "div",
  tone = "default",
  flush = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li"; tone?: "default" | "accent"; flush?: boolean }) {
  const base = "rounded-card border border-rule text-ink shadow-card";
  const pad = flush ? "" : "p-4 md:p-6";
  const bg = tone === "accent" ? "bg-accent-soft" : "bg-surface";
  return <Tag {...props} className={[base, pad, bg, className].filter(Boolean).join(" ")} />;
}
