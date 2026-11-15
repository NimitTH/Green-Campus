import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardSkeleton, DetailSkeleton, FormSkeleton, ListSkeleton, TableSkeleton } from "./skeletons";

const cases = [
  ["list", () => createElement(ListSkeleton)],
  ["detail", () => createElement(DetailSkeleton)],
  ["form", () => createElement(FormSkeleton)],
  ["dashboard", () => createElement(DashboardSkeleton)],
  ["table", () => createElement(TableSkeleton)],
] as const;

describe("skeletons", () => {
  it.each(cases)("%s is busy, announced, tagged and pulses", (name, make) => {
    const html = renderToStaticMarkup(make());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("กำลังโหลด...");
    expect(html).toContain("sr-only");
    expect(html).toContain(`data-skeleton="${name}"`);
    expect(html).toContain("motion-safe:animate-pulse");
  });

  it("ListSkeleton list view renders the requested rows", () => {
    const html = renderToStaticMarkup(createElement(ListSkeleton, { view: "list", rows: 3 }));
    expect(html.match(/data-skeleton-row/g)).toHaveLength(3);
  });
  it("ListSkeleton card view renders the requested cards", () => {
    const html = renderToStaticMarkup(createElement(ListSkeleton, { rows: 4 }));
    expect(html.match(/data-skeleton-row/g)).toHaveLength(4);
  });
  it("ListSkeleton can drop the toolbar", () => {
    expect(renderToStaticMarkup(createElement(ListSkeleton, { toolbar: false }))).not.toContain("data-skeleton-toolbar");
    expect(renderToStaticMarkup(createElement(ListSkeleton))).toContain("data-skeleton-toolbar");
  });
  it("ListSkeleton draws the page's toolbar shape (ListToolbarSkeleton): view toggle and filter count", () => {
    const withViews = renderToStaticMarkup(createElement(ListSkeleton));
    expect(withViews).toContain("w-[87px]"); // the view toggle
    const staff = renderToStaticMarkup(createElement(ListSkeleton, { view: "list", toolbar: { views: false, filters: 3 } }));
    expect(staff).not.toContain("w-[87px]");
    // the sort select + 3 filters are w-36 (the direction link is w-28)
    expect(staff.match(/h-11 w-36/g)).toHaveLength(4);
    expect(staff).toContain("mb-6"); // same gap below the toolbar as the page
  });
  it("ListSkeleton list rows can drop the thumbnail", () => {
    expect(renderToStaticMarkup(createElement(ListSkeleton, { view: "list", rows: 3 })).match(/data-skeleton-thumb/g)).toHaveLength(3);
    const noThumb = renderToStaticMarkup(createElement(ListSkeleton, { view: "list", rows: 3, thumb: false }));
    expect(noThumb).not.toContain("data-skeleton-thumb");
    expect(noThumb.match(/data-skeleton-row/g)).toHaveLength(3);
  });
  it("ListSkeleton shapes match the real covers and grids", () => {
    const card = renderToStaticMarkup(createElement(ListSkeleton, { gridClassName: "gap-6 md:grid-cols-3" }));
    expect(card).toContain("aspect-[4/3]");
    expect(card).toContain("md:grid-cols-3");
    expect(renderToStaticMarkup(createElement(ListSkeleton, { view: "list" }))).toContain("h-16 w-24");
  });
  it("TableSkeleton has a single space-y class", () => {
    const html = renderToStaticMarkup(createElement(TableSkeleton));
    expect(html.match(/space-y-/g)).toHaveLength(1);
  });
  it("FormSkeleton renders the requested fields; TableSkeleton the rows", () => {
    expect(renderToStaticMarkup(createElement(FormSkeleton, { fields: 2 })).match(/data-skeleton-field/g)).toHaveLength(2);
    expect(renderToStaticMarkup(createElement(TableSkeleton, { rows: 5 })).match(/data-skeleton-row/g)).toHaveLength(5);
  });
});
