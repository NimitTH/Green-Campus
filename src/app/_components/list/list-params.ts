// DESIGN-4 2.1/2.2: the query string of every list, driven by a per-page ListConfig (src/lib/**/list-config.ts).
// parseListParams always returns valid values (junk falls back to the defaults); listHref builds the canonical
// URL, omitting every default. Pure, so the server (queries) and the client (toolbar) share it.

export type SortKind = "date" | "number" | "text";
export type SortDir = "asc" | "desc";
export type ListView = "card" | "list";
export type SortSpec = { label: string; kind: SortKind; defaultDir: SortDir };
/** "all" is always an option and is not listed; defaultValue (when not "all") is what a missing param means. */
export type FilterSpec = { label: string; options: Record<string, string>; defaultValue?: string };
export type ListConfig = {
  sorts: Record<string, SortSpec>;
  /** The first sort shown, used when the URL has none (or an unknown one). */
  defaultSort: string;
  filters?: Record<string, FilterSpec>;
  /** Whether the page has the card / list toggle. */
  views?: boolean;
  /** Rows per page, PAGE_SIZE when omitted. */
  pageSize?: number;
};
export type ListState = { q: string; sort: string; dir: SortDir; filters: Record<string, string>; view: ListView; page: number };
export type RawParams = Record<string, string | string[] | undefined>;
export type ListPatch = Partial<Omit<ListState, "filters">> & { filters?: Record<string, string> };

export const PAGE_SIZE = 12;
export const Q_MAX = 100;
export const ALL = "all";

const LIST_KEYS = ["q", "sort", "dir", "view", "page"] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isDir(v: string | undefined): v is SortDir {
  return v === "asc" || v === "desc";
}

/** The value a missing filter param means. */
export function filterDefault(spec: FilterSpec): string {
  return spec.defaultValue ?? ALL;
}

function filterValue(spec: FilterSpec, raw: string | undefined): string {
  if (raw === ALL || (raw !== undefined && Object.hasOwn(spec.options, raw))) return raw;
  return filterDefault(spec);
}

/** Search text as stored in the state: trimmed and cut to Q_MAX characters. */
export function normalizeQ(raw: string): string {
  return Array.from(raw.trim()).slice(0, Q_MAX).join("").trim();
}

export function parseListParams(config: ListConfig, sp: RawParams): ListState {
  const q = normalizeQ(first(sp.q) ?? "");

  const rawSort = first(sp.sort);
  let sort = config.defaultSort;
  let legacyDir: SortDir | undefined;
  if (rawSort !== undefined && Object.hasOwn(config.sorts, rawSort)) sort = rawSort;
  else if ((rawSort === "new" || rawSort === "old") && Object.hasOwn(config.sorts, "date")) {
    // round 3: sort=new = date desc, sort=old = date asc
    sort = "date";
    legacyDir = rawSort === "old" ? "asc" : "desc";
  }
  const rawDir = first(sp.dir);
  const dir: SortDir = isDir(rawDir) ? rawDir : (legacyDir ?? config.sorts[sort].defaultDir);

  const filters: Record<string, string> = {};
  for (const [name, spec] of Object.entries(config.filters ?? {})) filters[name] = filterValue(spec, first(sp[name]));

  const view: ListView = config.views && first(sp.view) === "list" ? "list" : "card";

  const rawPage = first(sp.page) ?? "";
  const n = /^\d+$/.test(rawPage) ? Number(rawPage) : NaN;
  const page = Number.isSafeInteger(n) && n >= 1 ? n : 1;

  return { q, sort, dir, filters, view, page };
}

/**
 * The URL for `current` with `patch` applied. A change of q, sort, dir or a filter goes back to page 1; a view change
 * keeps the page. A new sort without a dir takes that sort's default dir.
 */
export function listHref(base: string, config: ListConfig, current: ListState, patch: ListPatch): string {
  const next: ListState = { ...current, ...patch, filters: { ...current.filters, ...patch.filters } };
  const sortChanged = patch.sort !== undefined && patch.sort !== current.sort;
  if (sortChanged && patch.dir === undefined) next.dir = config.sorts[next.sort]?.defaultDir ?? next.dir;
  const filtersChanged = Object.entries(patch.filters ?? {}).some(([k, v]) => current.filters[k] !== v);
  if ((patch.q !== undefined && patch.q !== current.q) || sortChanged || next.dir !== current.dir || filtersChanged) next.page = 1;

  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.sort !== config.defaultSort) sp.set("sort", next.sort);
  if (next.dir !== config.sorts[next.sort]?.defaultDir) sp.set("dir", next.dir);
  for (const [name, spec] of Object.entries(config.filters ?? {})) {
    const v = next.filters[name];
    if (v !== undefined && v !== filterDefault(spec)) sp.set(name, v);
  }
  if (next.view !== "card") sp.set("view", next.view);
  if (next.page !== 1) sp.set("page", String(next.page));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** URLSearchParams (e.g. from useSearchParams) as the record parseListParams takes: the list keys and filter names. */
export function searchParamsRecord(config: ListConfig, sp: URLSearchParams | { getAll(name: string): string[] }): RawParams {
  const out: RawParams = {};
  for (const key of [...LIST_KEYS, ...Object.keys(config.filters ?? {})]) {
    const all = sp.getAll(key);
    if (all.length > 0) out[key] = all;
  }
  return out;
}

const DIRECTION_LABELS: Record<SortKind, Record<SortDir, string>> = {
  date: { desc: "ใหม่ → เก่า", asc: "เก่า → ใหม่" },
  number: { desc: "มาก → น้อย", asc: "น้อย → มาก" },
  text: { asc: "ก → ฮ", desc: "ฮ → ก" },
};

/** The text of the sort direction button (DESIGN-4 2.3). */
export function directionLabel(kind: SortKind, dir: SortDir): string {
  return DIRECTION_LABELS[kind][dir];
}

/** Rows per page for this config. */
export function pageSizeOf(config: ListConfig): number {
  return config.pageSize ?? PAGE_SIZE;
}

/** True when the state narrows the list (search text or a filter off its default): "no match" rather than "empty". */
export function isNarrowed(config: ListConfig, state: Pick<ListState, "q" | "filters">): boolean {
  if (state.q) return true;
  return Object.entries(config.filters ?? {}).some(([name, spec]) => (state.filters[name] ?? filterDefault(spec)) !== filterDefault(spec));
}
