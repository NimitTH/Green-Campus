import Link from "next/link";
import { listHref, type ListParams, type ListView } from "./list-params";

const ICONS: Record<ListView, React.ReactNode> = {
  card: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  list: (
    <>
      <rect x="4" y="5" width="5" height="4" rx="1" />
      <path d="M12 7h8" />
      <rect x="4" y="15" width="5" height="4" rx="1" />
      <path d="M12 17h8" />
    </>
  ),
};

const LABELS: Record<ListView, string> = { card: "การ์ด", list: "รายการ" };

/** DESIGN-3 5.3: two links (card / list), the selected one marked aria-current. Keeps q, sort and page. */
export function ViewToggle({ base, params }: { base: string; params: ListParams }) {
  return (
    <div className="flex shrink-0">
      {(["card", "list"] as const).map((v) => {
        const selected = params.view === v;
        return (
          <Link
            key={v}
            href={listHref(base, params, { view: v })}
            aria-label={LABELS[v]}
            aria-current={selected ? "true" : undefined}
            scroll={false}
            className={[
              // a 44×44 segmented pair: each link has its own border, the second overlaps the first by 1px
              "relative inline-flex size-11 items-center justify-center border border-rule-strong first:rounded-l-input last:-ml-px last:rounded-r-input",
              "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              selected ? "z-[1] border-accent bg-accent-soft text-accent" : "bg-surface text-muted hover:text-ink",
            ].join(" ")}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {ICONS[v]}
            </svg>
          </Link>
        );
      })}
    </div>
  );
}
