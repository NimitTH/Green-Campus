import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Returns the body of the first `{ }` block that follows `header` in `source`. */
function blockAfter(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start < 0) return "";
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  return "";
}

type Tokens = Record<string, [number, number, number]>;

function parseTokens(body: string): Tokens {
  const out: Tokens = {};
  const re = /--([a-z0-9-]+):\s*oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)\s*;/g;
  for (const m of body.matchAll(re)) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return out;
}

function firstLightBlock(): string {
  const re = /:root\s*\{/g;
  for (const m of css.matchAll(re)) {
    const body = blockAfter(css.slice(m.index), ":root");
    if (body.includes("--paper:")) return body;
  }
  return "";
}

const lightBody = firstLightBlock();
const darkBody = blockAfter(css, ':root[data-theme="dark"]');
const systemBody = blockAfter(css, ':root:not([data-theme="light"])');
const light = parseTokens(lightBody);
const dark = parseTokens(blockAfter(css, ':root[data-theme="dark"]'));
const system = parseTokens(
  blockAfter(css, ':root:not([data-theme="light"])'),
);

function luminance([L, C, H]: [number, number, number]): number {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L / 100 + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L / 100 - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L / 100 - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  // linear sRGB channels feed WCAG luminance directly
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const text = ["ink", "muted", "accent", "danger", "warn"];
const pairs: [string, string, number][] = [
  ...text.flatMap((t) => [[t, "paper", 4.5], [t, "surface", 4.5]] as [string, string, number][]),
  ["on-accent", "accent", 4.5],
  ["ink", "accent-soft", 4.5],
  ["accent", "accent-soft", 4.5],
  ["rule-strong", "paper", 3],
  ["rule-strong", "surface", 3],
  ...[1, 2, 3, 4].map((n) => [`chart-${n}`, "surface", 3] as [string, string, number]),
];

describe("base rules", () => {
  const base = blockAfter(css, "@layer base").replace(/\s+/g, " ");
  it.each(["h1, h2, h3", ":focus-visible", "body", "::selection"])(
    "%s rule is inside @layer base so utilities can override it",
    (sel) => {
      expect(base).toContain(sel + " {");
    },
  );
});

const NEW_TOKENS = ["paper-3", "kraft", "kraft-2", "sun", "sea", "accent-deep", "margin", "line"];
const decl = (body: string, name: string) => body.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

describe("redesign 2 tokens", () => {
  it("new tokens exist in light and both dark blocks", () => {
    for (const n of NEW_TOKENS) {
      expect(decl(lightBody, n), `light --${n}`).toBeDefined();
      expect(decl(darkBody, n), `dark --${n}`).toBeDefined();
      expect(decl(systemBody, n), `system --${n}`).toBeDefined();
      expect(decl(systemBody, n)).toBe(decl(darkBody, n));
    }
  });

  describe.each([
    ["light", light],
    ["dark", dark],
  ] as const)("%s kraft/paper-3 AA", (name, t) => {
    it.each([
      ["ink", "kraft", 4.5],
      ["ink", "kraft-2", 4.5],
      ["muted", "kraft", 4.5],
      ["ink", "paper-3", 4.5],
      ["muted", "paper-3", 4.5],
      ["accent", "kraft-2", 3],
    ] as [string, string, number][])("%s on %s >= %s", (fg, bg, min) => {
      expect(t[fg], `missing --${fg}`).toBeDefined();
      expect(t[bg], `missing --${bg}`).toBeDefined();
      const r = contrast(t[fg], t[bg]);
      expect(r, `${name} ${fg} on ${bg}: ${r.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    });
  });

  it("paper surfaces live in components layer", () => {
    const comp = blockAfter(css, "@layer components").replace(/\s+/g, " ");
    for (const c of ["paper-ruled", "paper-dots", "paper-grid", "paper-kraft", "paper-torn"]) {
      expect(comp, `.${c}`).toContain(`.${c}`);
    }
  });
});

describe("theme tokens", () => {
  it("dark tokens are identical for data-theme and system dark", () => {
    expect(Object.keys(dark).length).toBeGreaterThan(10);
    expect(system).toEqual(dark);
  });

  it("defines the same token names in light and dark", () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  describe.each([
    ["light", light],
    ["dark", dark],
  ] as const)("%s contrast", (_name, tokens) => {
    it.each(pairs)("%s on %s >= %s", (fg, bg, min) => {
      expect(tokens[fg], `missing --${fg}`).toBeDefined();
      expect(tokens[bg], `missing --${bg}`).toBeDefined();
      const ratio = contrast(tokens[fg], tokens[bg]);
      expect(ratio, `${_name} ${fg} on ${bg}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    });
  });
});
