import { describe, expect, it } from "vitest";
import { parseListParams } from "@/app/_components/list/list-params";
import { STAFF_REWARD_CONFIG, STAFF_REWARD_SORT_COLUMN, staffRewardActiveFilter } from "./list-config";

describe("staffRewardActiveFilter", () => {
  it("maps yes/no to a boolean and everything else to null", () => {
    expect(staffRewardActiveFilter("yes")).toBe(true);
    expect(staffRewardActiveFilter("no")).toBe(false);
    expect(staffRewardActiveFilter("all")).toBeNull();
    expect(staffRewardActiveFilter(undefined)).toBeNull();
    expect(staffRewardActiveFilter("xyz")).toBeNull();
  });
});

describe("STAFF_REWARD_CONFIG", () => {
  it("sorts date desc, points asc, stock desc, name asc", () => {
    expect(STAFF_REWARD_CONFIG.defaultSort).toBe("date");
    expect(STAFF_REWARD_CONFIG.sorts.points.label).toBe("แต้ม");
    expect(STAFF_REWARD_CONFIG.sorts.stock.label).toBe("สต็อก");
    expect(STAFF_REWARD_SORT_COLUMN).toEqual({ date: "created_at", points: "points_cost", stock: "stock", name: "name" });
    expect(parseListParams(STAFF_REWARD_CONFIG, { sort: "price" })).toMatchObject({ sort: "date", dir: "desc" });
    expect(parseListParams(STAFF_REWARD_CONFIG, { active: "no" }).filters.active).toBe("no");
  });
});
