import Link from "next/link";
import { directionAriaLabel, directionLabel, listHref, type ListConfig, type ListState } from "./list-params";

/**
 * DESIGN-4 2.3: the sort direction button, a link to the other direction. It shows the current order
 * ("ใหม่ → เก่า", "ก → ฮ", …); its aria-label is "{shown}, กดเพื่อเปลี่ยนเป็น {other}".
 */
export function SortDirection({ base, config, state }: { base: string; config: ListConfig; state: ListState }) {
  const { kind, dirLabels } = config.sorts[state.sort];
  const other = state.dir === "asc" ? "desc" : "asc";
  return (
    <Link
      href={listHref(base, config, state, { dir: other })}
      aria-label={directionAriaLabel(kind, state.dir, dirLabels)}
      scroll={false}
      replace
      data-dir={state.dir}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-input border border-rule-strong bg-surface px-3 text-sm font-medium whitespace-nowrap text-ink hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3" />
      </svg>
      {directionLabel(kind, state.dir, dirLabels)}
    </Link>
  );
}
