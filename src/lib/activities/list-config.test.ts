import { describe, expect, it } from "vitest";
import { STAFF_ACTIVITY_CONFIG, STAFF_ACTIVITY_SORT_COLUMN, staffActivityFilters } from "./list-config";

describe("staffActivityFilters", () => {
  it("is empty when nothing is filtered", () => {
    expect(staffActivityFilters({})).toEqual([]);
    expect(staffActivityFilters({ type: "all", status: "all", code: "all" })).toEqual([]);
  });

  it("maps each filter to a [column, op, value] triple", () => {
    expect(staffActivityFilters({ type: "waste" })).toEqual([["type", "eq", "waste"]]);
    expect(staffActivityFilters({ status: "draft" })).toEqual([["status", "eq", "draft"]]);
    expect(staffActivityFilters({ code: "yes" })).toEqual([["requires_code", "eq", true]]);
    expect(staffActivityFilters({ code: "no" })).toEqual([["requires_code", "eq", false]]);
  });

  it("combines filters and ignores unknown values", () => {
    expect(staffActivityFilters({ type: "trees", status: "open", code: "yes" })).toEqual([
      ["type", "eq", "trees"],
      ["status", "eq", "open"],
      ["requires_code", "eq", true],
    ]);
    expect(staffActivityFilters({ type: "xyz", status: "", code: "maybe" })).toEqual([]);
  });
});

describe("STAFF_ACTIVITY_CONFIG", () => {
  it("sorts by date desc, participants desc, name asc", () => {
    expect(STAFF_ACTIVITY_CONFIG.defaultSort).toBe("date");
    expect(STAFF_ACTIVITY_CONFIG.sorts.date.defaultDir).toBe("desc");
    expect(STAFF_ACTIVITY_CONFIG.sorts.participants.defaultDir).toBe("desc");
    expect(STAFF_ACTIVITY_CONFIG.sorts.name.defaultDir).toBe("asc");
    expect(STAFF_ACTIVITY_SORT_COLUMN).toEqual({ date: "created_at", participants: "participant_count", name: "title" });
  });
});
