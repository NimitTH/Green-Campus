import { describe, expect, it } from "vitest";
import { formatGramsTh, formatKgTh, summaryTh } from "./format";

describe("formatGramsTh", () => {
  it("kg and ขีด", () => {
    expect(formatGramsTh(1500)).toBe("1 กก. 5 ขีด");
  });
  it("leftover grams are shown", () => {
    expect(formatGramsTh(1550)).toBe("1 กก. 5 ขีด 50 กรัม");
  });
  it("omits zero parts", () => {
    expect(formatGramsTh(2000)).toBe("2 กก.");
    expect(formatGramsTh(300)).toBe("3 ขีด");
    expect(formatGramsTh(0)).toBe("0 กรัม");
  });
});

describe("formatKgTh", () => {
  it("grams as kg, up to 3 decimals", () => {
    expect(formatKgTh(1500)).toBe("1.5 กก.");
    expect(formatKgTh(1234567)).toBe("1,234.567 กก.");
  });
});

describe("summaryTh", () => {
  it("waste: total kg", () => {
    expect(summaryTh("waste", [1500, 200])).toBe("รวม 1.7 กก.");
  });
  it("trees: count", () => {
    expect(summaryTh("trees", [3])).toBe("3 ต้น");
  });
  it("fixed: เข้าร่วม", () => {
    expect(summaryTh("fixed", [1])).toBe("เข้าร่วม");
  });
});
