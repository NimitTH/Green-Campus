// DESIGN-3 5.1/5.3: the query string of the public lists (/articles, /activities). parseListParams always
// returns valid values (junk falls back to the defaults); listHref builds the canonical URL, omitting defaults.

export type ListSort = "new" | "old";
export type ListView = "card" | "list";
export type ListParams = { q: string; sort: ListSort; view: ListView; page: number };

export const PAGE_SIZE = 12;
export const Q_MAX = 100;

const DEFAULTS: ListParams = { q: "", sort: "new", view: "card", page: 1 };

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseListParams(sp: RawParams): ListParams {
  const q = Array.from((first(sp.q) ?? "").trim()).slice(0, Q_MAX).join("").trim();
  const sort: ListSort = first(sp.sort) === "old" ? "old" : "new";
  const view: ListView = first(sp.view) === "list" ? "list" : "card";
  const rawPage = first(sp.page) ?? "";
  const n = /^\d+$/.test(rawPage) ? Number(rawPage) : NaN;
  const page = Number.isSafeInteger(n) && n >= 1 ? n : 1;
  return { q, sort, view, page };
}

/** The URL for `current` with `patch` applied. A change of q or sort goes back to page 1. */
export function listHref(base: string, current: ListParams, patch: Partial<ListParams>): string {
  const next: ListParams = { ...current, ...patch };
  const searchChanged = (patch.q !== undefined && patch.q !== current.q) || (patch.sort !== undefined && patch.sort !== current.sort);
  if (searchChanged) next.page = 1;
  const sp = new URLSearchParams();
  if (next.q !== DEFAULTS.q) sp.set("q", next.q);
  if (next.sort !== DEFAULTS.sort) sp.set("sort", next.sort);
  if (next.view !== DEFAULTS.view) sp.set("view", next.view);
  if (next.page !== DEFAULTS.page) sp.set("page", String(next.page));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** URLSearchParams (e.g. from useSearchParams) as the record parseListParams takes. */
export function searchParamsRecord(sp: URLSearchParams | { getAll(name: string): string[] }): RawParams {
  const out: RawParams = {};
  for (const key of ["q", "sort", "view", "page"]) {
    const all = sp.getAll(key);
    if (all.length > 0) out[key] = all;
  }
  return out;
}
