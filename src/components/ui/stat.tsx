export function Stat({
  label,
  size = "md",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { label: React.ReactNode; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "text-4xl" : "text-2xl";
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p
        {...props}
        className={["font-mono font-semibold leading-tight text-ink", sizeClass, className].filter(Boolean).join(" ")}
      >
        {children}
      </p>
    </div>
  );
}
