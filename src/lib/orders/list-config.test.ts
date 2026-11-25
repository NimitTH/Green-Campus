import { describe, expect, it } from "vitest";
import { parseListParams } from "@/app/_components/list/list-params";
import { MY_ORDER_CONFIG, orderSearchFilter, STAFF_ORDER_CONFIG, STAFF_ORDER_SORT_COLUMN, staffOrderFilter, staffOrderSearchFilter } from "./list-config";

describe("orderSearchFilter", () => {
  it("matches the item names, the order number and, for a hex prefix, the old number range", () => {
    expect(orderSearchFilter("a1b")).toBe(
      'item_names.ilike."%a1b%",order_no.ilike."%a1b%",and(id.gte.a1b00000-0000-0000-0000-000000000000,id.lte.a1bfffff-ffff-ffff-ffff-ffffffffffff)',
    );
  });
  it("has no old-number branch when the text is not a hex prefix", () => {
    expect(orderSearchFilter("สมุด")).toBe('item_names.ilike."%สมุด%",order_no.ilike."%สมุด%"');
    expect(orderSearchFilter("ORD-20261125-0001")).toBe('item_names.ilike."%ORD-20261125-0001%",order_no.ilike."%ORD-20261125-0001%"');
  });
  it("escapes LIKE wildcards and quotes in the item pattern", () => {
    expect(orderSearchFilter('50%_"x')).toBe(
      String.raw`item_names.ilike."%50\\%\\_\"x%",order_no.ilike."%50\\%\\_\"x%"`,
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

describe("staffOrderFilter", () => {
  it("open is every pending_pickup order", () => {
    expect(staffOrderFilter("open")).toEqual(["status", "eq", "pending_pickup"]);
  });
  it("the other options filter status_group", () => {
    expect(staffOrderFilter("preparing")).toEqual(["status_group", "eq", "preparing"]);
    expect(staffOrderFilter("ready")).toEqual(["status_group", "eq", "ready"]);
    expect(staffOrderFilter("completed")).toEqual(["status_group", "eq", "completed"]);
    expect(staffOrderFilter("closed")).toEqual(["status_group", "eq", "closed"]);
  });
  it("all adds no filter; missing and unknown fall back to open", () => {
    expect(staffOrderFilter("all")).toBeNull();
    expect(staffOrderFilter(undefined)).toEqual(["status", "eq", "pending_pickup"]);
    expect(staffOrderFilter("xyz")).toEqual(["status", "eq", "pending_pickup"]);
  });
});

describe("staffOrderSearchFilter", () => {
  it("matches both name columns and, for a hex prefix, the number range", () => {
    expect(staffOrderSearchFilter("a1b")).toBe(
      'buyer_full_name.ilike."%a1b%",buyer_display_name.ilike."%a1b%",order_no.ilike."%a1b%",and(id.gte.a1b00000-0000-0000-0000-000000000000,id.lte.a1bfffff-ffff-ffff-ffff-ffffffffffff)',
    );
    expect(staffOrderSearchFilter("สม")).toBe('buyer_full_name.ilike."%สม%",buyer_display_name.ilike."%สม%",order_no.ilike."%สม%"');
  });
});

describe("STAFF_ORDER_CONFIG", () => {
  it("sorts date asc, points desc, buyer asc; status defaults to open", () => {
    expect(STAFF_ORDER_CONFIG.defaultSort).toBe("date");
    expect(STAFF_ORDER_CONFIG.sorts.date.defaultDir).toBe("asc");
    expect(STAFF_ORDER_CONFIG.sorts.points.defaultDir).toBe("desc");
    expect(STAFF_ORDER_CONFIG.sorts.buyer.defaultDir).toBe("asc");
    expect(STAFF_ORDER_CONFIG.filters.status.defaultValue).toBe("open");
    expect(STAFF_ORDER_SORT_COLUMN).toEqual({ date: "created_at", points: "total_points", buyer: "buyer_name" });
    expect(parseListParams(STAFF_ORDER_CONFIG, {})).toMatchObject({ sort: "date", dir: "asc", filters: { status: "open" } });
    expect(parseListParams(STAFF_ORDER_CONFIG, { status: "all" }).filters.status).toBe("all");
  });
});
