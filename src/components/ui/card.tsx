export function Card({
  as: Tag = "div",
  tone = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li"; tone?: "default" | "accent" }) {
  const base = "rounded-card border border-rule p-4 text-ink shadow-card md:p-6";
  const bg = tone === "accent" ? "bg-accent-soft" : "bg-surface";
  return <Tag {...props} className={[base, bg, className].filter(Boolean).join(" ")} />;
}
