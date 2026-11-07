// DESIGN-4 2.4: the one paging path every DB-backed list uses. fetchPage runs one page of a query and maps "offset
// past the last row" (PostgREST PGRST103, HTTP 416) to a head count with no items; loadClamped then re-queries the last
// page when the URL's page is past the end (?page=999, or the list shrank). The page size always comes from
// pageSizeOf(config). Pure (the queries are passed in), so both are unit-tested without a database.
import { pageSizeOf, type ListConfig } from "./list-params";

type PageError = { code?: string; message: string };
/** What an awaited PostgREST select with { count: "exact" } resolves to (only the fields used here). */
export type PageResponse<T> = { data: T[] | null; error: PageError | null; count: number | null };
/** What an awaited PostgREST select with { count: "exact", head: true } resolves to. */
export type HeadResponse = { error: { message: string } | null; count: number | null };

/** The inclusive row range of `page` (1-based; junk or < 1 means page 1). */
export function pageRange(page: number, size: number): { from: number; to: number } {
  const p = Math.max(1, Math.trunc(page) || 1);
  return { from: (p - 1) * size, to: p * size - 1 };
}

/** The last page of a list of `total` rows (at least 1). */
export function lastPageOf(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * One page of rows. `run(from, to)` is the filtered, ordered query with .range(from, to); `head()` the same filters
 * as a head count. Past the last row: `{ items: [], total }` from the head count. Any other error throws
 * `${label}: ${message}`.
 */
export async function fetchPage<T>(
  label: string,
  opts: { page: number; size: number; run: (from: number, to: number) => PromiseLike<PageResponse<T>>; head: () => PromiseLike<HeadResponse> },
): Promise<{ items: T[]; total: number }> {
  const { from, to } = pageRange(opts.page, opts.size);
  const { data, error, count } = await opts.run(from, to);
  if (error?.code === "PGRST103") {
    const head = await opts.head();
    if (head.error || head.count === null) throw new Error(`${label}: ${head.error?.message ?? "no count"}`);
    return { items: [], total: head.count };
  }
  if (error) throw new Error(`${label}: ${error.message}`);
  const items = data ?? [];
  return { items, total: count ?? items.length };
}

/**
 * Loads `params`, and when its page is past the last page of a non-empty result, loads the last page instead. The
 * loader may return null (a failed, e.g. cached, load); that is passed through without a second call.
 */
export async function loadClamped<P extends { page: number }, R extends { total: number } | null>(
  config: ListConfig,
  params: P,
  load: (p: P) => Promise<R> | R,
): Promise<{ params: P; result: R }> {
  const result = await load(params);
  if (!result || result.total === 0) return { params, result };
  const lastPage = lastPageOf(result.total, pageSizeOf(config));
  if (params.page <= lastPage) return { params, result };
  const clamped = { ...params, page: lastPage };
  return { params: clamped, result: await load(clamped) };
}
