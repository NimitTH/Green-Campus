import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, Button, Card, Field, PageHeader, Stat, buttonClass, inputClass, inputClassLg } from "./index";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("Button", () => {
  it("does not default the type attribute", () => {
    const out = html(createElement(Button, null, "ยืนยันแลก"));
    expect(out).not.toContain(" type=");
    expect(out).toContain("<button");
    expect(out).toContain("ยืนยันแลก");
  });
  it("passes props through", () => {
    const out = html(
      createElement(
        Button,
        { type: "submit", "data-testid": "x", "aria-label": "ก", disabled: true } as React.ComponentProps<typeof Button>,
        "ยืนยันแลก",
      ),
    );
    expect(out).toContain('type="submit"');
    expect(out).toContain('data-testid="x"');
    expect(out).toContain('aria-label="ก"');
    expect(out).toContain("disabled");
    expect(out).toContain("ยืนยันแลก");
  });
  it("buttonClass variants and sizes", () => {
    const p = buttonClass({ variant: "primary", size: "lg" });
    expect(p).toContain("bg-accent");
    expect(p).toContain("text-on-accent");
    expect(p).toContain("min-h-12");
    expect(buttonClass()).toContain("min-h-11");
    expect(buttonClass({ className: "w-full" }).endsWith("w-full")).toBe(true);
  });
  it("sm keeps a 44px target and does not stack text-size or padding utilities", () => {
    const sm = buttonClass({ size: "sm" });
    expect(sm).toContain("min-h-11");
    expect(sm).toContain("text-sm");
    expect(sm).toContain("px-3");
    for (const size of ["sm", "md", "lg"] as const) {
      const tokens = buttonClass({ size }).split(" ");
      expect(tokens.filter((t) => /^text-(sm|base|lg|xl)$/.test(t))).toHaveLength(1);
      expect(tokens.filter((t) => /^px-\d/.test(t))).toHaveLength(1);
      expect(tokens.filter((t) => /^min-h-/.test(t))).toHaveLength(1);
    }
    expect(buttonClass()).toContain("motion-reduce:translate-none");
  });
  it("primary has a single letterpress shadow token", () => {
    const tokens = buttonClass({ variant: "primary" }).split(" ");
    expect(tokens.filter((t) => /(^|:)shadow-/.test(t))).toHaveLength(1);
  });
});

describe("Card decoration", () => {
  it("renders deco as an aria-hidden, non-interactive span", () => {
    const out = html(createElement(Card, { deco: "tape" }, "x"));
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("pointer-events-none");
    expect(out).toContain("data-deco");
  });
  it("renders no deco span by default", () => {
    expect(html(createElement(Card, null, "x"))).not.toContain("data-deco");
  });
  it("tilt is disabled under reduced motion and straightens on hover", () => {
    const out = html(createElement(Card, { tilt: true }, "x"));
    expect(out).toContain("motion-reduce:rotate-0");
    expect(out).toContain("hover:rotate-0");
  });
});

describe("Card", () => {
  it("renders as li with accent tone", () => {
    const out = html(createElement(Card, { as: "li", tone: "accent" }, "x"));
    expect(out).toContain("<li");
    expect(out).toContain("bg-accent-soft");
  });
  it("keeps padding by default and drops it when flush", () => {
    const def = html(createElement(Card, null, "x"));
    expect(def).toContain("p-4");
    expect(def).toContain("md:p-6");
    const flush = html(createElement(Card, { flush: true }, "x"));
    expect(flush).not.toMatch(/p-4/);
    expect(flush).not.toContain("md:p-6");
  });
});

describe("Badge", () => {
  it.each([
    ["red", "text-danger"],
    ["amber", "text-warn"],
    ["green", "text-accent"],
    ["gray", "text-muted"],
  ] as const)("tone %s", (tone, cls) => {
    expect(html(createElement(Badge, { tone }, "b"))).toContain(cls);
  });
  it("defaults to gray", () => {
    expect(html(createElement(Badge, null, "b"))).toContain("text-muted");
  });
});

describe("Stat", () => {
  it("puts rest props on the mono number", () => {
    const out = html(createElement(Stat, { label: "แต้ม", "data-testid": "points" } as React.ComponentProps<typeof Stat>, "120"));
    expect(out).toMatch(/<p[^>]*data-testid="points"[^>]*>120<\/p>/);
    expect(out).toMatch(/<p[^>]*font-mono[^>]*data-testid="points"|<p[^>]*data-testid="points"[^>]*font-mono/);
  });
});

describe("inputClassLg", () => {
  it("swaps the size utilities instead of stacking them", () => {
    expect(inputClassLg).toContain("min-h-12");
    expect(inputClassLg).toContain("text-xl");
    expect(inputClassLg).not.toContain("min-h-11");
    expect(inputClassLg).not.toContain("text-base");
  });
  it("leaves inputClass unchanged", () => {
    expect(inputClass).toContain("min-h-11");
    expect(inputClass).toContain("text-base");
  });
});

describe("Field", () => {
  it("links label and shows alert error", () => {
    const out = html(createElement(Field, { id: "f1", label: "อีเมล", error: "ผิด" } as React.ComponentProps<typeof Field>, createElement("input", { id: "f1" })));
    expect(out).toContain('<label for="f1"');
    expect(out).toContain('role="alert"');
  });
});

describe("PageHeader", () => {
  it("renders h1", () => {
    expect(html(createElement(PageHeader, { title: "ตรวจผล" }))).toContain("<h1");
  });
});

describe("invalid inputs", () => {
  it("show a danger border in inputClass and inputClassLg", () => {
    expect(inputClass).toContain("aria-[invalid=true]:border-danger");
    expect(inputClassLg).toContain("aria-[invalid=true]:border-danger");
  });
});
