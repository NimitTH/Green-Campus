import { afterEach, describe, expect, it, vi } from "vitest";
import { uniqueId } from "./unique-id";
import { isUuid } from "./uuid";

afterEach(() => vi.unstubAllGlobals());

describe("uniqueId", () => {
  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    expect(uniqueId()).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("falls back to a v4-format uuid from getRandomValues (plain http, no randomUUID)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xff);
        return bytes;
      },
    });
    const id = uniqueId();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("4");
    expect("89ab").toContain(id[19]);
  });

  it("fallback ids differ between calls", () => {
    let n = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(++n);
        return bytes;
      },
    });
    expect(uniqueId()).not.toBe(uniqueId());
  });

  it("still returns a uuid-shaped string with no crypto at all", () => {
    vi.stubGlobal("crypto", undefined);
    expect(isUuid(uniqueId())).toBe(true);
  });
});
