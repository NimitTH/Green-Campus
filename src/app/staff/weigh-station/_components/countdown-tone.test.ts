import { describe, expect, it } from "vitest";
import { countdownTone } from "./countdown-tone";

describe("countdownTone", () => {
  it("is normal above five minutes", () => {
    expect(countdownTone(1_800_000)).toBe("normal");
    expect(countdownTone(300_001)).toBe("normal");
  });
  it("warns at five minutes or less", () => {
    expect(countdownTone(300_000)).toBe("warn");
    expect(countdownTone(1)).toBe("warn");
  });
  it("is danger at zero or below", () => {
    expect(countdownTone(0)).toBe("danger");
    expect(countdownTone(-5)).toBe("danger");
  });
});
