// DESIGN-4 2.4: sorting and paging done in the app (lists loaded whole, e.g. /cart). Text compares with the Thai
// collator, nulls go last in both directions, ties keep their input order.
import { PAGE_SIZE, type SortDir, type SortKind } from "./list-params";

const collator = new Intl.Collator("th");

function compareValues(a: string | number, b: string | number, kind: SortKind): number {
  if (kind === "number") return Number(a) - Number(b);
  if (kind === "date") {
    const ta = typeof a === "number" ? a : Date.parse(a);
    const tb = typeof b === "number" ? b : Date.parse(b);
    return ta - tb;
  }
  return collator.compare(String(a), String(b));
}

/** A sorted copy of `rows` (the input is not changed). */
export function sortRows<T>(rows: T[], key: (r: T) => string | number | null, kind: SortKind, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: key(row) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      return sign * compareValues(a.value, b.value, kind) || a.index - b.index;
    })
    .map((e) => e.row);
}

/** One page of `rows`; a page past the end (or below 1) clamps to the last (or first) page. */
export function paginateRows<T>(rows: T[], page: number, size: number = PAGE_SIZE): { items: T[]; page: number; lastPage: number } {
  const lastPage = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), lastPage);
  return { items: rows.slice((current - 1) * size, current * size), page: current, lastPage };
}
