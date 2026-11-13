import { describe, expect, it } from "vitest";
import { listHref, parseListParams } from "@/app/_components/list/list-params";
import { STUDENT_ACCOUNT_CONFIG } from "./list-config";

describe("STUDENT_ACCOUNT_CONFIG", () => {
  it("defaults to newest sign-up first, all statuses", () => {
    expect(parseListParams(STUDENT_ACCOUNT_CONFIG, {})).toMatchObject({ sort: "date", dir: "desc", filters: { status: "all" }, page: 1 });
  });

  it("name sorts ก → ฮ and points sorts most first by default", () => {
    expect(parseListParams(STUDENT_ACCOUNT_CONFIG, { sort: "name" })).toMatchObject({ sort: "name", dir: "asc" });
    expect(parseListParams(STUDENT_ACCOUNT_CONFIG, { sort: "points" })).toMatchObject({ sort: "points", dir: "desc" });
  });

  it("only the three statuses the database accepts; anything else is all", () => {
    for (const status of ["active", "suspended", "must_change"]) {
      expect(parseListParams(STUDENT_ACCOUNT_CONFIG, { status }).filters.status).toBe(status);
    }
    expect(parseListParams(STUDENT_ACCOUNT_CONFIG, { status: "banned" }).filters.status).toBe("all");
    expect(parseListParams(STUDENT_ACCOUNT_CONFIG, { sort: "email" }).sort).toBe("date");
  });

  it("a status change goes back to page 1", () => {
    const state = parseListParams(STUDENT_ACCOUNT_CONFIG, { page: "3" });
    expect(listHref("/staff/students", STUDENT_ACCOUNT_CONFIG, state, { filters: { status: "suspended" } })).toBe("/staff/students?status=suspended");
  });
});
