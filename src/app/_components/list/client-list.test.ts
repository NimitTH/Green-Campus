import { describe, expect, it } from "vitest";
import { paginateRows, sortRows } from "./client-list";

describe("sortRows", () => {
  const names = ["ฮา", "กระดาษ", "ไก่", "เกม", null];
  const byName = (r: string | null) => r;

  it("Thai text in ก-ฮ order, nulls last in both directions", () => {
    expect(sortRows(names, byName, "text", "asc")).toEqual(["กระดาษ", "เกม", "ไก่", "ฮา", null]);
    expect(sortRows(names, byName, "text", "desc")).toEqual(["ฮา", "ไก่", "เกม", "กระดาษ", null]);
  });

  it("numbers and dates, nulls last", () => {
    expect(sortRows([3, null, 1, 2], (n) => n, "number", "asc")).toEqual([1, 2, 3, null]);
    expect(sortRows([3, null, 1, 2], (n) => n, "number", "desc")).toEqual([3, 2, 1, null]);
    const dates = ["2026-01-02T00:00:00Z", null, "2025-12-31T00:00:00Z"];
    expect(sortRows(dates, (d) => d, "date", "desc")).toEqual(["2026-01-02T00:00:00Z", "2025-12-31T00:00:00Z", null]);
    expect(sortRows(dates, (d) => d, "date", "asc")).toEqual(["2025-12-31T00:00:00Z", "2026-01-02T00:00:00Z", null]);
  });

  it("ties keep their input order in both directions and the input is not mutated", () => {
    const rows = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "c", n: 1 },
    ];
    expect(sortRows(rows, (r) => r.n, "number", "asc").map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(sortRows(rows, (r) => r.n, "number", "desc").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("paginateRows", () => {
  const rows = Array.from({ length: 25 }, (_, i) => i);

  it("12 per page by default; a page past the end clamps to the last page", () => {
    expect(paginateRows(rows, 1)).toEqual({ items: rows.slice(0, 12), page: 1, lastPage: 3 });
    expect(paginateRows(rows, 9)).toMatchObject({ page: 3, lastPage: 3 });
    expect(paginateRows(rows, 9).items).toHaveLength(1);
  });

  it("a custom size, junk pages and an empty list", () => {
    expect(paginateRows(rows, 2, 10).items).toEqual(rows.slice(10, 20));
    expect(paginateRows(rows, 0)).toMatchObject({ page: 1 });
    expect(paginateRows([], 4)).toEqual({ items: [], page: 1, lastPage: 1 });
  });
});
