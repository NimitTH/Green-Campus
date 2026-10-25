const TONES = {
  gray: "bg-[color-mix(in_oklab,var(--muted)_14%,var(--surface))] text-muted",
  green: "bg-[color-mix(in_oklab,var(--accent)_14%,var(--surface))] text-accent",
  amber: "bg-[color-mix(in_oklab,var(--warn)_14%,var(--surface))] text-warn",
  red: "bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface))] text-danger",
} as const;

export function Badge({
  tone = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      {...props}
      className={["inline-block rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone], className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
