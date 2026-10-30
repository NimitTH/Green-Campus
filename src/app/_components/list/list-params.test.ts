import { describe, expect, it } from "vitest";
import { PAGE_SIZE, listHref, parseListParams } from "./list-params";

describe("parseListParams", () => {
  it("defaults for an empty query", () => {
    expect(parseListParams({})).toEqual({ q: "", sort: "new", view: "card", page: 1 });
    expect(PAGE_SIZE).toBe(12);
  });

  it("junk page values fall back to 1; an array takes its first value", () => {
    expect(parseListParams({ page: "-3" }).page).toBe(1);
    expect(parseListParams({ page: "abc" }).page).toBe(1);
    expect(parseListParams({ page: "0" }).page).toBe(1);
    expect(parseListParams({ page: "2.5" }).page).toBe(1);
    expect(parseListParams({ page: "99999999999999999999" }).page).toBe(1);
    expect(parseListParams({ page: ["2", "3"] }).page).toBe(2);
    expect(parseListParams({ page: "999" }).page).toBe(999);
  });

  it("unknown sort / view fall back to the defaults", () => {
    expect(parseListParams({ sort: "xyz", view: "grid" })).toEqual({ q: "", sort: "new", view: "card", page: 1 });
    expect(parseListParams({ sort: "old", view: "list" })).toMatchObject({ sort: "old", view: "list" });
  });

  it("q is trimmed and cut to 100 characters", () => {
    expect(parseListParams({ q: "  ขยะ  " }).q).toBe("ขยะ");
    const long = "ก".repeat(150);
    expect(parseListParams({ q: long }).q).toBe("ก".repeat(100));
    expect(parseListParams({ q: `${"a".repeat(99)} b` }).q).toBe("a".repeat(99));
  });
});

describe("listHref", () => {
  it("omits defaults and resets page when sort changes", () => {
    expect(listHref("/articles", { q: "a", sort: "new", view: "list", page: 3 }, { sort: "old" })).toBe("/articles?q=a&sort=old&view=list");
  });

  it("resets page when q changes, keeps it when only view changes", () => {
    expect(listHref("/articles", { q: "a", sort: "old", view: "card", page: 3 }, { q: "b" })).toBe("/articles?q=b&sort=old");
    expect(listHref("/articles", { q: "", sort: "new", view: "card", page: 3 }, { view: "list" })).toBe("/articles?view=list&page=3");
    expect(listHref("/articles", { q: "", sort: "new", view: "list", page: 2 }, { page: 1, view: "card" })).toBe("/articles");
  });

  it("encodes search text", () => {
    expect(listHref("/articles", { q: "", sort: "new", view: "card", page: 1 }, { q: 'a,b"(%&' })).toBe("/articles?q=a%2Cb%22%28%25%26");
  });
});
