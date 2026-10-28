import { describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, applyThemeChoice, nextThemeChoice, parseThemeChoice, readThemeChoice } from "./theme";

function fakeRoot() {
  return { setAttribute: vi.fn(), removeAttribute: vi.fn() };
}

describe("parseThemeChoice", () => {
  it("accepts light and dark, everything else is system", () => {
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice(null)).toBe("system");
    expect(parseThemeChoice("blue")).toBe("system");
    expect(parseThemeChoice("")).toBe("system");
  });
});

describe("readThemeChoice", () => {
  it("reads the stored value", () => {
    expect(readThemeChoice({ getItem: () => "dark" })).toBe("dark");
    expect(readThemeChoice(undefined)).toBe("system");
  });
  it("falls back to system when storage throws", () => {
    const storage = { getItem: () => { throw new Error("blocked"); } };
    expect(readThemeChoice(storage)).toBe("system");
  });
});

describe("applyThemeChoice", () => {
  it("dark sets the attribute and stores it", () => {
    const root = fakeRoot();
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    applyThemeChoice("dark", root, storage);
    expect(root.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
  });
  it("system removes the attribute and the stored value", () => {
    const root = fakeRoot();
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    applyThemeChoice("system", root, storage);
    expect(root.removeAttribute).toHaveBeenCalledWith("data-theme");
    expect(storage.removeItem).toHaveBeenCalledWith("theme");
    expect(root.setAttribute).not.toHaveBeenCalled();
  });
  it("swallows storage errors but still sets the attribute", () => {
    const root = fakeRoot();
    const storage = {
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("quota"); },
    };
    expect(() => applyThemeChoice("dark", root, storage)).not.toThrow();
    expect(root.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
    expect(() => applyThemeChoice("system", root, storage)).not.toThrow();
  });
});

describe("nextThemeChoice", () => {
  it("flips the theme currently shown", () => {
    expect(nextThemeChoice(true)).toBe("light");
    expect(nextThemeChoice(false)).toBe("dark");
  });
  it("still applies dark on the root when storage throws", () => {
    const root = fakeRoot();
    const storage = {
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => applyThemeChoice(nextThemeChoice(false), root, storage)).not.toThrow();
    expect(root.setAttribute).toHaveBeenCalledWith("data-theme", "dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function run(getItem: () => string | null) {
    const setAttribute = vi.fn();
    const run = new Function("document", "localStorage", THEME_INIT_SCRIPT);
    run({ documentElement: { setAttribute } }, { getItem });
    return setAttribute;
  }
  it("sets dark", () => {
    expect(run(() => "dark")).toHaveBeenCalledWith("data-theme", "dark");
  });
  it("ignores unknown values", () => {
    expect(run(() => "blue")).not.toHaveBeenCalled();
  });
  it("does not throw when storage throws", () => {
    expect(() => run(() => { throw new Error("blocked"); })).not.toThrow();
  });
});
