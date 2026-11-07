import { describe, expect, it } from "vitest";
import { cartRemainder } from "./cart-summary";

describe("cartRemainder", () => {
  it("is left when the balance covers the total", () => {
    expect(cartRemainder(1200, 900)).toEqual({ kind: "left", points: 300 });
  });
  it("is short when the total is more than the balance", () => {
    expect(cartRemainder(500, 900)).toEqual({ kind: "short", points: 400 });
  });
  it("is left with 0 when they are equal", () => {
    expect(cartRemainder(900, 900)).toEqual({ kind: "left", points: 0 });
  });
});
