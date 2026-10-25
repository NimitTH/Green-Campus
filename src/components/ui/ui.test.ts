import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, Button, Card, Field, PageHeader, Stat, buttonClass } from "./index";

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
});

describe("Card", () => {
  it("renders as li with accent tone", () => {
    const out = html(createElement(Card, { as: "li", tone: "accent" }, "x"));
    expect(out).toContain("<li");
    expect(out).toContain("bg-accent-soft");
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
