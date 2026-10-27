import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Mono } from "./mono";

const render = (text: string) => renderToStaticMarkup(createElement(Mono, { text }));
const monoSpans = (html: string) => [...html.matchAll(/<span class="font-mono">([^<]*)<\/span>/g)].map((m) => m[1]);
const stripped = (html: string) => html.replace(/<[^>]*>/g, "");

describe("Mono", () => {
  it("wraps one digit run with separators in a mono span and keeps the text", () => {
    const html = render("ประมาณการ: 1,234.5 แต้ม");
    expect(monoSpans(html)).toEqual(["1,234.5"]);
    expect(stripped(html)).toBe("ประมาณการ: 1,234.5 แต้ม");
  });
  it("keeps a trailing full stop outside the span", () => {
    const html = render("ได้ 15 แต้ม.");
    expect(monoSpans(html)).toEqual(["15"]);
    expect(stripped(html)).toBe("ได้ 15 แต้ม.");
    expect(render("รวม 1,234.")).toContain("</span>.");
  });
  it("renders no mono span without digits", () => {
    expect(render("ไม่มีตัวเลข")).not.toContain("font-mono");
  });
  it("renders an empty string as nothing", () => {
    expect(render("")).toBe("");
  });
});
