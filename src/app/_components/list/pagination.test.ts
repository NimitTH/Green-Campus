import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ListConfig, ListState } from "./list-params";
import { Pagination, pageWindow } from "./pagination";

const config: ListConfig = { sorts: { date: { label: "วันที่", kind: "date", defaultDir: "desc" } }, defaultSort: "date", views: true };
const state: ListState = { q: "", sort: "date", dir: "desc", filters: {}, view: "card", page: 1 };
const html = (total: number, page = 1, cfg: ListConfig = config) =>
  renderToStaticMarkup(createElement(Pagination, { base: "/articles", config: cfg, state: { ...state, page }, total }));

describe("pageWindow", () => {
  it("first, current ± 1 and last, with … for gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 10)).toEqual([1, 2, "…", 10]);
    expect(pageWindow(10, 10)).toEqual([1, "…", 9, 10]);
  });
});

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    expect(html(12)).toBe("");
    expect(html(0)).toBe("");
  });

  it("two pages: numbered links, aria-current on the current page, prev/next", () => {
    const out = html(13, 2);
    expect(out).toContain('aria-label="แบ่งหน้า"');
    // attribute order is not fixed: look-aheads inside one <a ...>
    expect(out).toMatch(/<a(?=[^>]*href="\/articles")(?=[^>]*aria-label="หน้าก่อน")[^>]*>/);
    expect(out).toMatch(/<a(?=[^>]*href="\/articles")(?=[^>]*aria-label="หน้า 1")[^>]*>/);
    expect(out).toMatch(/<a(?=[^>]*href="\/articles\?page=2")(?=[^>]*aria-current="page")[^>]*>2</);
    expect(out).not.toMatch(/<a[^>]*aria-label="หน้าถัดไป"/);
  });

  it("uses the config's page size", () => {
    expect(html(12, 1, { ...config, pageSize: 5 })).toMatch(/aria-label="หน้า 3"/);
    expect(html(5, 1, { ...config, pageSize: 5 })).toBe("");
  });
});
