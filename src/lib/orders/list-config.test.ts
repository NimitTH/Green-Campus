import { describe, expect, it } from "vitest";
import { parseListParams } from "@/app/_components/list/list-params";
import { MY_ORDER_CONFIG, orderSearchFilter } from "./list-config";

describe("orderSearchFilter", () => {
  it("matches the item names and, for a hex prefix, the order-number range", () => {
    expect(orderSearchFilter("a1b")).toBe(
      'item_names.ilike."%a1b%",and(id.gte.a1b00000-0000-0000-0000-000000000000,id.lte.a1bfffff-ffff-ffff-ffff-ffffffffffff)',
    );
  });
  it("has no number branch when the text is not a hex prefix", () => {
    expect(orderSearchFilter("สมุด")).toBe('item_names.ilike."%สมุด%"');
  });
  it("escapes LIKE wildcards and quotes in the item pattern", () => {
    expect(orderSearchFilter('50%_"x')).toBe(
      String.raw`item_names.ilike."%50\\%\\_\"x%"`,
    );
  });
});

describe("MY_ORDER_CONFIG", () => {
  it("sorts by date only, newest first", () => {
    expect(Object.keys(MY_ORDER_CONFIG.sorts)).toEqual(["date"]);
    expect(parseListParams(MY_ORDER_CONFIG, { sort: "price" })).toMatchObject({
      sort: "date",
      dir: "desc",
    });
  });
});
