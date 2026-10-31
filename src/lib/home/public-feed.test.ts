import { describe, expect, it } from "vitest";
import { parseActiveRewards, parseOpenActivities } from "./public-feed";

const toUrl = (path: string) => `https://cdn.test/${path}`;

describe("parseOpenActivities", () => {
  it("maps snake_case rows to camelCase", () => {
    expect(
      parseOpenActivities(
        [{ id: "a1", title: "เก็บขยะ", type: "waste", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-30T00:00:00Z", cover_path: null }],
        toUrl,
      ),
    ).toEqual([{ id: "a1", title: "เก็บขยะ", type: "waste", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-30T00:00:00Z", coverUrl: null }]);
  });
  it("maps cover_path to coverUrl with toUrl; null stays null", () => {
    const calls: string[] = [];
    const rows = parseOpenActivities(
      [
        { id: "a1", title: "x", type: "fixed", starts_at: "s", ends_at: "e", cover_path: "a1/c.jpg" },
        { id: "a2", title: "y", type: "fixed", starts_at: "s", ends_at: "e", cover_path: null },
      ],
      (p) => (calls.push(p), toUrl(p)),
    );
    expect(rows?.map((r) => r.coverUrl)).toEqual(["https://cdn.test/a1/c.jpg", null]);
    expect(calls).toEqual(["a1/c.jpg"]);
    expect(parseOpenActivities([{ id: "a1", title: "x", type: "fixed", starts_at: "s", ends_at: "e", cover_path: 5 }], toUrl)).toBeNull();
  });
  it("accepts an empty array", () => {
    expect(parseOpenActivities([], toUrl)).toEqual([]);
  });
  it("returns null for non-arrays and malformed rows", () => {
    expect(parseOpenActivities(null, toUrl)).toBeNull();
    expect(parseOpenActivities({}, toUrl)).toBeNull();
    expect(parseOpenActivities([{ id: "a1", title: "x", type: "waste", starts_at: "s" }], toUrl)).toBeNull();
    expect(parseOpenActivities([null], toUrl)).toBeNull();
  });
});

describe("parseActiveRewards", () => {
  it("uses toUrl only for rows with an image_path", () => {
    const calls: string[] = [];
    const result = parseActiveRewards(
      [
        { id: "r1", name: "สมุด", points_cost: 10, stock: 3, image_path: "r1/a.jpg" },
        { id: "r2", name: "ปากกา", points_cost: 5, stock: 1, image_path: null },
      ],
      (p) => (calls.push(p), toUrl(p)),
    );
    expect(result).toEqual([
      { id: "r1", name: "สมุด", pointsCost: 10, stock: 3, imageUrl: "https://cdn.test/r1/a.jpg" },
      { id: "r2", name: "ปากกา", pointsCost: 5, stock: 1, imageUrl: null },
    ]);
    expect(calls).toEqual(["r1/a.jpg"]);
  });
  it("returns null for non-arrays and rows missing fields", () => {
    expect(parseActiveRewards("x", toUrl)).toBeNull();
    expect(parseActiveRewards([{ id: "r1", name: "n", stock: 1, image_path: null }], toUrl)).toBeNull();
  });
});
