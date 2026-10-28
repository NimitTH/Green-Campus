import Link from "next/link";

export type ButtonVariant = "primary" | "card" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-input font-medium " +
  "transition duration-[var(--dur-short)] ease-[var(--ease-out)] motion-reduce:translate-none motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-55 disabled:pointer-events-none aria-disabled:opacity-55 aria-disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent shadow-press hover:-translate-y-px active:translate-y-px",
  card: "bg-surface text-ink border border-rule-strong shadow-sheet hover:bg-accent-soft",
  quiet: "bg-transparent text-ink hover:bg-accent-soft",
  danger: "bg-surface text-danger border border-danger hover:bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface))]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-sm",
  md: "min-h-11 px-4 text-base",
  lg: "min-h-12 px-4 text-base",
};

export function buttonClass({
  variant = "card",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return [BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(" ");
}

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize };

/** Thin wrapper: no default `type` (a form's default submit button must stay a submit button). */
export function Button({
  variant,
  size,
  className,
  ...props
}: React.ComponentPropsWithRef<"button"> & StyleProps) {
  return <button {...props} className={buttonClass({ variant, size, className })} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<typeof Link> & StyleProps) {
  return <Link {...props} className={buttonClass({ variant, size, className })} />;
}
