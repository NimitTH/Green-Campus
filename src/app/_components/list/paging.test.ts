import { describe, expect, it, vi } from "vitest";
import type { ListConfig, ListState } from "./list-params";
import { fetchPage, lastPageOf, loadClamped, pageRange } from "./paging";

const config: ListConfig = { sorts: { date: { label: "วันที่", kind: "date", defaultDir: "desc" } }, defaultSort: "date" };
const state: ListState = { q: "", sort: "date", dir: "desc", filters: {}, view: "card", page: 1 };

describe("pageRange", () => {
  it("is the inclusive row range of a page; junk pages mean page 1", () => {
    expect(pageRange(1, 12)).toEqual({ from: 0, to: 11 });
    expect(pageRange(3, 5)).toEqual({ from: 10, to: 14 });
    expect(pageRange(0, 12)).toEqual({ from: 0, to: 11 });
    expect(pageRange(Number.NaN, 12)).toEqual({ from: 0, to: 11 });
    expect(pageRange(2.7, 12)).toEqual({ from: 12, to: 23 });
  });
});

describe("lastPageOf", () => {
  it("is at least 1", () => {
    expect(lastPageOf(0, 12)).toBe(1);
    expect(lastPageOf(12, 12)).toBe(1);
    expect(lastPageOf(13, 12)).toBe(2);
    expect(lastPageOf(13, 5)).toBe(3);
  });
});

describe("fetchPage", () => {
  const ok = <T,>(data: T[], count: number) => Promise.resolve({ data, error: null, count });

  it("runs the paged query on the page's range and returns its rows and count", async () => {
    const run = vi.fn(() => ok(["a", "b"], 7));
    const head = vi.fn(() => Promise.resolve({ error: null, count: 0 }));
    await expect(fetchPage("t", { page: 2, size: 5, run, head })).resolves.toEqual({ items: ["a", "b"], total: 7 });
    expect(run).toHaveBeenCalledWith(5, 9);
    expect(head).not.toHaveBeenCalled();
  });

  it("falls back to the row count when the count is missing", async () => {
    const out = await fetchPage("t", { page: 1, size: 12, run: () => Promise.resolve({ data: ["a"], error: null, count: null }), head: vi.fn() });
    expect(out).toEqual({ items: ["a"], total: 1 });
  });

  it("past the last row (PGRST103): a head count and no items", async () => {
    const head = vi.fn(() => Promise.resolve({ error: null, count: 13 }));
    const run = () => Promise.resolve({ data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null });
    await expect(fetchPage("t", { page: 99, size: 12, run, head })).resolves.toEqual({ items: [], total: 13 });
    expect(head).toHaveBeenCalledTimes(1);
  });

  it("throws on any other error, and when the head count fails", async () => {
    const bad = () => Promise.resolve({ data: null, error: { code: "42501", message: "denied" }, count: null });
    await expect(fetchPage("listX", { page: 1, size: 12, run: bad, head: vi.fn() })).rejects.toThrow("listX: denied");
    const past = () => Promise.resolve({ data: null, error: { code: "PGRST103", message: "range" }, count: null });
    await expect(fetchPage("listX", { page: 9, size: 12, run: past, head: () => Promise.resolve({ error: { message: "boom" }, count: null }) })).rejects.toThrow(
      "listX: boom",
    );
    await expect(fetchPage("listX", { page: 9, size: 12, run: past, head: () => Promise.resolve({ error: null, count: null }) })).rejects.toThrow(
      "listX: no count",
    );
  });
});

describe("loadClamped", () => {
  it("keeps a page inside the list", async () => {
    const load = vi.fn((p: ListState) => Promise.resolve({ total: 30, page: p.page }));
    const out = await loadClamped(config, { ...state, page: 2 }, load);
    expect(out).toEqual({ params: { ...state, page: 2 }, result: { total: 30, page: 2 } });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("re-queries the last page (config page size) when the page is past the end", async () => {
    const load = vi.fn((p: ListState) => Promise.resolve({ total: 13, page: p.page }));
    const out = await loadClamped({ ...config, pageSize: 5 }, { ...state, page: 99 }, load);
    expect(out.params.page).toBe(3);
    expect(out.result).toEqual({ total: 13, page: 3 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not re-query an empty list or a failed load", async () => {
    const empty = vi.fn(() => Promise.resolve({ total: 0 }));
    expect(await loadClamped(config, { ...state, page: 4 }, empty)).toEqual({ params: { ...state, page: 4 }, result: { total: 0 } });
    expect(empty).toHaveBeenCalledTimes(1);
    const failed = vi.fn(() => Promise.resolve(null));
    expect(await loadClamped(config, { ...state, page: 4 }, failed)).toEqual({ params: { ...state, page: 4 }, result: null });
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("accepts a synchronous loader", async () => {
    const out = await loadClamped(config, { ...state, page: 5 }, (p) => ({ total: 20, page: p.page }));
    expect(out.result).toEqual({ total: 20, page: 2 });
  });
});
