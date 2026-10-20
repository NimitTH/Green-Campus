import { describe, expect, it } from "vitest";
import { internalLink } from "./link";

describe("internalLink", () => {
  it("accepts internal paths", () => {
    expect(internalLink("/my-submissions")).toBe("/my-submissions");
    expect(internalLink("/staff/reviews/abc?x=1")).toBe("/staff/reviews/abc?x=1");
  });
  it.each([null, undefined, "", "https://evil.com", "//evil.com", "/\t/evil.com", "/\n/evil.com", String.raw`/\evil.com`, "evil", "/a/..//evil.com"])(
    "rejects %j",
    (v) => {
      expect(internalLink(v as string | null)).toBeNull();
    },
  );
});
