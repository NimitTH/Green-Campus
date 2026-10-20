import { describe, expect, it } from "vitest";
import { wrapThai } from "./thai-wrap";

// A fake measure: every character (code point) is 1 unit wide, so widths are easy to reason about.
const len = (s: string) => [...s].length;

describe("wrapThai", () => {
  it("keeps text that fits on one line", () => {
    expect(wrapThai("เก็บขยะ", 20, len)).toBe("เก็บขยะ");
  });

  it("breaks Thai (no spaces) at word boundaries, never inside a word", () => {
    const out = wrapThai("โรงเรียนของเราร่วมกันเก็บขยะ", 12, len);
    const lines = out.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("โรงเรียนของเราร่วมกันเก็บขยะ");
    for (const line of lines) expect(len(line)).toBeLessThanOrEqual(12);
    // every line boundary is a word boundary of Intl.Segmenter
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    const bounds = new Set<number>();
    let at = 0;
    for (const s of seg.segment("โรงเรียนของเราร่วมกันเก็บขยะ")) bounds.add((at += s.segment.length));
    let pos = 0;
    for (const line of lines.slice(0, -1)) expect(bounds.has((pos += line.length))).toBe(true);
  });

  it("drops the space at a line break between spaced words", () => {
    expect(wrapThai("ที่ น้ำ ผู้", 5, len)).toBe("ที่\nน้ำ\nผู้");
  });

  it("splits a word longer than the line by grapheme clusters, keeping tone marks on their consonant", () => {
    // "ปุ่น" is one word of 4 code points; at width 3 the cluster ปุ่ stays whole.
    expect(wrapThai("ปุ่น", 3, len)).toBe("ปุ่\nน");
    expect(wrapThai("abcdefg", 3, len)).toBe("abc\ndef\ng");
  });

  it("keeps existing line breaks", () => {
    expect(wrapThai("ก\nข", 10, len)).toBe("ก\nข");
  });
});
