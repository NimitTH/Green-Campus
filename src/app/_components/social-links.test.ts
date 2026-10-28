import { describe, expect, it } from "vitest";
import { SOCIAL_LINKS, visibleSocialLinks } from "./social-links";

describe("visibleSocialLinks", () => {
  it("returns [] for an empty list", () => {
    expect(visibleSocialLinks([])).toEqual([]);
  });
  it("hides every platform while the default hrefs are empty", () => {
    expect(SOCIAL_LINKS.length).toBe(5);
    expect(visibleSocialLinks()).toEqual([]);
  });
  it("keeps only links with a non-blank href", () => {
    const out = visibleSocialLinks([
      { platform: "x", label: "X", href: "https://x.com/a" },
      { platform: "line", label: "LINE", href: "  " },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].platform).toBe("x");
  });
});
