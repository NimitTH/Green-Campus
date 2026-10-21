import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const BOM = "﻿";

describe("toCsv", () => {
  it("starts with a BOM and ends every line with CRLF", () => {
    const out = toCsv([["a", "b"], ["c", "d"]]);
    expect(out.startsWith(BOM)).toBe(true);
    expect(out).toBe(`${BOM}a,b\r\nc,d\r\n`);
  });

  it("guards formulas and quotes commas and newlines (Review Focus 3)", () => {
    expect(toCsv([["=1+1", "a,b", "x\ny"]])).toBe(`${BOM}'=1+1,"a,b","x\ny"\r\n`);
  });

  it("guards every formula trigger character", () => {
    expect(toCsv([["+1", "-1", "@x", "\tx", "\rx"]])).toBe(`${BOM}'+1,'-1,'@x,'\tx,"'\rx"\r\n`);
  });

  it("doubles quotes inside text", () => {
    expect(toCsv([['say "hi"']])).toBe(`${BOM}"say ""hi"""\r\n`);
  });

  it("quotes cells with leading or trailing spaces", () => {
    expect(toCsv([[" a", "b ", "c d"]])).toBe(`${BOM}" a","b ",c d\r\n`);
  });

  it("writes null as an empty cell and numbers as-is (no guard on -3)", () => {
    expect(toCsv([[null, -3, 0.125, 7]])).toBe(`${BOM},-3,0.125,7\r\n`);
  });

  it("leaves Thai unchanged, but guards a Thai name starting with -", () => {
    expect(toCsv([["พลาสติก (กก.)", "-สมชาย"]])).toBe(`${BOM}พลาสติก (กก.),'-สมชาย\r\n`);
  });

  it("header-only output is the header line", () => {
    expect(toCsv([["ชื่อ", "แต้ม"]])).toBe(`${BOM}ชื่อ,แต้ม\r\n`);
  });
});
