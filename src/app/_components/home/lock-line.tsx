/** "Sign in to ..." footer of a home card: a padlock and the text, on a dashed rule. */
export function LockLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-auto flex items-center gap-1.5 border-t border-dashed border-rule pt-3 text-sm font-semibold text-accent">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false" className="shrink-0">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      {children}
    </p>
  );
}
