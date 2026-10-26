export const inputClass =
  "block min-h-11 w-full rounded-input border border-rule-strong bg-surface px-3 py-2 text-base text-ink " +
  "placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent " +
  "aria-[invalid=true]:border-danger disabled:opacity-55";

export const inputClassLg = inputClass.replace("min-h-11", "min-h-12").replace("text-base", "text-xl");

/** The caller passes the id (from useId) and puts the matching control in children. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={["flex flex-col gap-1", className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
