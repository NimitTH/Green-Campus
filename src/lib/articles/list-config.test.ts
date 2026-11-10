import { describe, expect, it } from "vitest";
import { parseListParams } from "@/app/_components/list/list-params";
import { STAFF_ARTICLE_CONFIG, STAFF_ARTICLE_SORT_COLUMN, staffArticleSearchFilter } from "./list-config";

describe("staffArticleSearchFilter", () => {
  it("matches the title only, literally", () => {
    expect(staffArticleSearchFilter("50%")).toBe('title.ilike."%50' + String.fromCharCode(92).repeat(2) + '%%"');
  });
});

describe("STAFF_ARTICLE_CONFIG", () => {
  it("sorts date desc and name asc; filters by category", () => {
    expect(Object.keys(STAFF_ARTICLE_CONFIG.sorts)).toEqual(["date", "name"]);
    // review M2 (task 11): rows show "แก้ไขล่าสุด", so the date sort is the last edit
    expect(STAFF_ARTICLE_SORT_COLUMN).toEqual({ date: "updated_at", name: "title" });
    expect(parseListParams(STAFF_ARTICLE_CONFIG, { sort: "category" })).toMatchObject({ sort: "date", dir: "desc" });
    expect(parseListParams(STAFF_ARTICLE_CONFIG, { category: "announcement" }).filters.category).toBe("announcement");
  });
});
