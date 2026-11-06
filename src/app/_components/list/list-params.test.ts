import { describe, expect, it } from "vitest";
import { PAGE_SIZE, Q_MAX, directionLabel, listHref, parseListParams, searchParamsRecord, type ListConfig, type ListState } from "./list-params";

const cfg: ListConfig = {
  sorts: {
    date: { label: "วันที่", kind: "date", defaultDir: "desc" },
    price: { label: "ราคา", kind: "number", defaultDir: "asc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  filters: { type: { label: "ประเภท", options: { a: "เอ", b: "บี" } } },
  views: true,
};

const statusCfg: ListConfig = {
  sorts: { date: { label: "วันที่", kind: "date", defaultDir: "desc" } },
  defaultSort: "date",
  filters: { status: { label: "สถานะ", options: { open: "เปิด", closed: "ปิด" }, defaultValue: "open" } },
};

const DEFAULT_STATE: ListState = { q: "", sort: "date", dir: "desc", filters: { type: "all" }, view: "card", page: 1 };

describe("parseListParams", () => {
  it("defaults for an empty query", () => {
    expect(parseListParams(cfg, {})).toEqual(DEFAULT_STATE);
    expect(PAGE_SIZE).toBe(12);
    expect(Q_MAX).toBe(100);
  });

  it("round-3 sort=new / sort=old map to date desc / asc", () => {
    expect(parseListParams(cfg, { sort: "old" })).toMatchObject({ sort: "date", dir: "asc" });
    expect(parseListParams(cfg, { sort: "new" })).toMatchObject({ sort: "date", dir: "desc" });
  });

  it("sort=new / old fall back to the defaults when the config has no date sort", () => {
    const noDate: ListConfig = { sorts: { name: { label: "ชื่อ", kind: "text", defaultDir: "asc" } }, defaultSort: "name" };
    expect(parseListParams(noDate, { sort: "old" })).toMatchObject({ sort: "name", dir: "asc" });
  });

  it("a sort without dir takes that sort's default dir; an explicit dir wins", () => {
    expect(parseListParams(cfg, { sort: "price" })).toMatchObject({ sort: "price", dir: "asc" });
    expect(parseListParams(cfg, { sort: "price", dir: "desc" })).toMatchObject({ sort: "price", dir: "desc" });
    expect(parseListParams(cfg, { dir: "asc" })).toMatchObject({ sort: "date", dir: "asc" });
  });

  it("junk sort / dir / filter / view / page fall back to the defaults", () => {
    expect(parseListParams(cfg, { sort: "xyz", dir: "up", type: "zzz", view: "grid", page: "-3" })).toEqual(DEFAULT_STATE);
    expect(parseListParams(cfg, { sort: "constructor", type: "toString" })).toEqual(DEFAULT_STATE);
    expect(parseListParams(cfg, { type: "" })).toEqual(DEFAULT_STATE);
  });

  it("known filter values and views are kept", () => {
    expect(parseListParams(cfg, { type: "b", view: "list" })).toMatchObject({ filters: { type: "b" }, view: "list" });
    expect(parseListParams(cfg, { type: "all" }).filters).toEqual({ type: "all" });
  });

  it("view is always card when the config has no views", () => {
    expect(parseListParams(statusCfg, { view: "list" }).view).toBe("card");
  });

  it("a filter with a defaultValue: missing means the default, status=all means all", () => {
    expect(parseListParams(statusCfg, {}).filters).toEqual({ status: "open" });
    expect(parseListParams(statusCfg, { status: "all" }).filters).toEqual({ status: "all" });
    expect(parseListParams(statusCfg, { status: "closed" }).filters).toEqual({ status: "closed" });
    expect(parseListParams(statusCfg, { status: "" }).filters).toEqual({ status: "open" });
  });

  it("junk page values fall back to 1; an array takes its first value", () => {
    const page = (p: string | string[]) => parseListParams(cfg, { page: p }).page;
    expect(page("-3")).toBe(1);
    expect(page("abc")).toBe(1);
    expect(page("0")).toBe(1);
    expect(page("2.5")).toBe(1);
    expect(page("99999999999999999999")).toBe(1);
    expect(page(["2", "3"])).toBe(2);
    expect(page("999")).toBe(999);
  });

  it("q is trimmed and cut to 100 characters", () => {
    expect(parseListParams(cfg, { q: "  ขยะ  " }).q).toBe("ขยะ");
    expect(parseListParams(cfg, { q: "ก".repeat(150) }).q).toBe("ก".repeat(100));
    expect(parseListParams(cfg, { q: `${"a".repeat(99)} b` }).q).toBe("a".repeat(99));
  });
});

describe("listHref", () => {
  it("a filter change resets the page and omits the defaults", () => {
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, page: 3 }, { filters: { type: "a" } })).toBe("/x?type=a");
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, filters: { type: "a" }, page: 3 }, { filters: { type: "all" } })).toBe("/x");
  });

  it("a view change keeps the page", () => {
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, page: 3 }, { view: "list" })).toBe("/x?view=list&page=3");
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, view: "list", page: 2 }, { page: 1, view: "card" })).toBe("/x");
  });

  it("q / sort / dir changes reset the page", () => {
    const s: ListState = { ...DEFAULT_STATE, q: "a", view: "list", page: 3 };
    expect(listHref("/x", cfg, s, { q: "b" })).toBe("/x?q=b&view=list");
    expect(listHref("/x", cfg, s, { dir: "asc" })).toBe("/x?q=a&dir=asc&view=list");
    expect(listHref("/x", cfg, s, { sort: "name" })).toBe("/x?q=a&sort=name&view=list");
  });

  it("a new sort without a dir takes the new sort's default dir", () => {
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, sort: "name", dir: "desc" }, { sort: "date" })).toBe("/x");
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, dir: "asc" }, { sort: "price" })).toBe("/x?sort=price");
    expect(listHref("/x", cfg, DEFAULT_STATE, { sort: "price", dir: "desc" })).toBe("/x?sort=price&dir=desc");
  });

  it("dir is written only when it differs from the sort's default", () => {
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, sort: "price", dir: "asc" }, { page: 2 })).toBe("/x?sort=price&page=2");
    expect(listHref("/x", cfg, { ...DEFAULT_STATE, sort: "price", dir: "desc" }, { page: 2 })).toBe("/x?sort=price&dir=desc&page=2");
  });

  it("a filter with a non-all default writes <name>=all when all is picked", () => {
    const s = parseListParams(statusCfg, {});
    expect(listHref("/y", statusCfg, s, { filters: { status: "all" } })).toBe("/y?status=all");
    expect(listHref("/y", statusCfg, { ...s, filters: { status: "all" } }, { filters: { status: "open" } })).toBe("/y");
  });

  it("encodes search text", () => {
    expect(listHref("/x", cfg, DEFAULT_STATE, { q: 'a,b"(%&' })).toBe("/x?q=a%2Cb%22%28%25%26");
  });
});

describe("searchParamsRecord", () => {
  it("keeps the list keys and the config's filter names only", () => {
    const sp = new URLSearchParams("q=a&sort=name&dir=desc&type=b&view=list&page=2&other=x&page=3");
    expect(searchParamsRecord(cfg, sp)).toEqual({ q: ["a"], sort: ["name"], dir: ["desc"], type: ["b"], view: ["list"], page: ["2", "3"] });
    expect(parseListParams(cfg, searchParamsRecord(cfg, sp))).toEqual({ q: "a", sort: "name", dir: "desc", filters: { type: "b" }, view: "list", page: 2 });
  });
});

describe("directionLabel", () => {
  it("names the order for each kind", () => {
    expect(directionLabel("date", "desc")).toBe("ใหม่ → เก่า");
    expect(directionLabel("date", "asc")).toBe("เก่า → ใหม่");
    expect(directionLabel("number", "desc")).toBe("มาก → น้อย");
    expect(directionLabel("number", "asc")).toBe("น้อย → มาก");
    expect(directionLabel("text", "asc")).toBe("ก → ฮ");
    expect(directionLabel("text", "desc")).toBe("ฮ → ก");
  });
});
