import { describe, expect, it } from "vitest";
import { ACTIVITY_BUCKET, isActivityCoverPath } from "./cover";

const ID = "3f2b6c1e-8a4d-4b7e-9c2a-1d5e6f7a8b9c";
const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const FILE = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("activity covers (DESIGN-3 6.1)", () => {
  it("uses the activity-images bucket", () => {
    expect(ACTIVITY_BUCKET).toBe("activity-images");
  });
  it("accepts <own id>/<uuid>.jpg", () => {
    expect(isActivityCoverPath(`${ID}/${FILE}.jpg`, ID)).toBe(true);
    expect(isActivityCoverPath(`${ID}/${FILE}.jpg`, ID.toUpperCase())).toBe(true);
  });
  it("rejects another activity's folder", () => {
    expect(isActivityCoverPath(`${OTHER}/${FILE}.jpg`, ID)).toBe(false);
  });
  it("rejects other shapes", () => {
    for (const p of ["", `${ID}/${FILE}.png`, `${ID}/${FILE}xjpg`,`${ID}/${FILE.toUpperCase()}.jpg`, `${ID}/x.jpg`, `../${ID}/${FILE}.jpg`, `${ID}/${FILE}.jpg/x`]) {
      expect(isActivityCoverPath(p, ID), p).toBe(false);
    }
  });
});
