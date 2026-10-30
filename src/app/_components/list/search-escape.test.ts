import { describe, expect, it } from "vitest";
import { quoteOrValue, toIlikePattern } from "./search-escape";

describe("toIlikePattern", () => {
  it("escapes \\ % _ and wraps in %", () => {
    expect(toIlikePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
    expect(toIlikePattern("ขยะ")).toBe("%ขยะ%");
  });

  it("maps * to the one-character wildcard _ (PostgREST turns * into % and has no escape for it)", () => {
    expect(toIlikePattern("a*b")).toBe("%a_b%");
  });
});

describe("quoteOrValue", () => {
  it('wraps in "…" escaping " and \\', () => {
    expect(quoteOrValue('a,"b')).toBe('"a,\\"b"');
    expect(quoteOrValue("a\\b")).toBe('"a\\\\b"');
  });

  it("keeps PostgREST separators inside the quotes", () => {
    expect(quoteOrValue(toIlikePattern('a,b"(%'))).toBe('"%a,b\\"(\\\\%%"');
  });
});
