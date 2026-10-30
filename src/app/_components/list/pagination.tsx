import Link from "next/link";
import { PAGE_SIZE, listHref, type ListParams } from "./list-params";

/** Page numbers to show: 1, current ± 1 and the last page; a gap of one page shows that page, longer gaps "…". */
export function pageWindow(current: number, last: number): (number | "…")[] {
  const wanted = new Set([1, last, current - 1, current, current + 1].filter((n) => n >= 1 && n <= last));
  const pages = [...wanted].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (const n of pages) {
    const prev = out.length > 0 ? out[out.length - 1] : undefined;
    if (typeof prev === "number" && n - prev === 2) out.push(prev + 1);
    else if (typeof prev === "number" && n - prev > 2) out.push("…");
    out.push(n);
  }
  return out;
}

const BOX =
  "inline-flex size-11 items-center justify-center rounded-input text-sm font-medium " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const LINK = `${BOX} text-ink hover:bg-accent-soft`;

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** DESIGN-3 5.3: previous / next and page numbers. Nothing when everything fits on one page. */
export function Pagination({ base, params, total }: { base: string; params: ListParams; total: number }) {
  if (total <= PAGE_SIZE) return null;
  const last = Math.ceil(total / PAGE_SIZE);
  const current = Math.min(Math.max(params.page, 1), last);
  const href = (page: number) => listHref(base, params, { page });
  return (
    <nav aria-label="แบ่งหน้า" className="mt-8 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {current > 1 ? (
            <Link href={href(current - 1)} aria-label="หน้าก่อน" className={LINK}>
              <Chevron dir="prev" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${BOX} text-muted opacity-55`}>
              <Chevron dir="prev" />
            </span>
          )}
        </li>
        {pageWindow(current, last).map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="inline-flex size-11 items-center justify-center text-muted">
              …
            </li>
          ) : (
            <li key={p}>
              {p === current ? (
                <Link href={href(p)} aria-label={`หน้า ${p}`} aria-current="page" className={`${BOX} bg-accent text-on-accent`}>
                  {p}
                </Link>
              ) : (
                <Link href={href(p)} aria-label={`หน้า ${p}`} className={LINK}>
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {current < last ? (
            <Link href={href(current + 1)} aria-label="หน้าถัดไป" className={LINK}>
              <Chevron dir="next" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${BOX} text-muted opacity-55`}>
              <Chevron dir="next" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
