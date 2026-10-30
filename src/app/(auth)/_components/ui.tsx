import { useId, type ReactNode } from "react";
import { PasswordInput, buttonClass, inputClass } from "@/components/ui";

export function FormTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-semibold text-ink">
        <span className="ink-highlight">{title}</span>
      </h1>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  error,
  hint,
  labelAction,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  /** Shown at the right of the label row (e.g. the forgot-password link). */
  labelAction?: ReactNode;
}) {
  // useId, not `name`: login and register stay mounted together (<Activity>), so a fixed id would collide.
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {labelAction}
      </div>
      {type === "password" ? (
        <PasswordInput
          id={id}
          name={name}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={inputClass}
        />
      )}
      {hint && !error ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass({ variant: "primary", size: "lg", className: "w-full" })}
    >
      {pending ? "กำลังดำเนินการ..." : children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const style =
    kind === "error"
      ? "border-danger bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-danger"
      : "border-accent bg-accent-soft text-ink";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`mb-4 rounded-input border p-3 text-sm ${style}`}>
      {children}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-4">
      <div className="h-6 w-1/2 rounded bg-paper-2" />
      <div className="h-12 rounded bg-paper-2" />
      <div className="h-12 rounded bg-paper-2" />
      <div className="h-12 rounded bg-paper-2" />
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3 text-sm text-muted">
      <span className="h-px flex-1 bg-rule-strong" aria-hidden="true" />
      <span>หรือ</span>
      <span className="h-px flex-1 bg-rule-strong" aria-hidden="true" />
    </div>
  );
}
