import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoverFallback, coverKindForActivity } from "./cover-fallback";

describe("coverKindForActivity", () => {
  it("maps the activity types", () => {
    expect(coverKindForActivity("waste")).toBe("waste");
    expect(coverKindForActivity("trees")).toBe("trees");
    expect(coverKindForActivity("fixed")).toBe("fixed");
  });
  it("falls back to waste for an unknown type", () => {
    expect(coverKindForActivity("x")).toBe("waste");
    expect(coverKindForActivity("")).toBe("waste");
  });
});

describe("CoverFallback", () => {
  it("renders a hidden, kind-tagged box with an svg icon", () => {
    const html = renderToStaticMarkup(createElement(CoverFallback, { kind: "fixed", className: "h-16 w-24" }));
    expect(html).toContain('data-cover-fallback="fixed"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<svg");
    expect(html).toContain("h-16 w-24");
  });
  it.each(["waste", "trees", "fixed", "article"] as const)("renders %s", (kind) => {
    expect(renderToStaticMarkup(createElement(CoverFallback, { kind }))).toContain(`data-cover-fallback="${kind}"`);
  });
});
