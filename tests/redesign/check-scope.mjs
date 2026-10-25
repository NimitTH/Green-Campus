// Redesign guard (no dependencies). Run: node tests/redesign/check-scope.mjs [--write-baseline]
//  1. no forbidden path changed (main...HEAD plus working tree)
//  2. no UI text / data-testid / aria-label disappeared from src/**/*.tsx (only the ThemeToggle strings may be new)
//  3. the number of 'use cache' directives in src/** equals the recorded baseline
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const baselineFile = join(here, "ui-strings.baseline.txt");
const writeBaseline = process.argv.includes("--write-baseline");

const FORBIDDEN_PREFIXES = ["supabase/migrations/", "supabase/tests/", "src/app/actions/", "src/lib/", "src/app/api/", "scripts/"];
const FORBIDDEN_FILES = ["src/proxy.ts"];
const ALLOWED_NEW = new Set(["text:ธีม", "text:สว่าง", "text:มืด", "text:ตามระบบ", "aria:ธีม"]);

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/).filter(Boolean);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments, including {/* ... */}
    .replace(/(^|\s)\/\/.*$/gm, "$1"); // line comments (needs leading whitespace so http:// survives)
}

const THAI = /[฀-๿][฀-๿\s0-9A-Za-z.,:;!?()/%-]*/g;
const TESTID = /data-testid=(?:"([^"]*)"|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\})/g;
const ARIA = /aria-label=(?:"([^"]*)"|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\})/g;

function collect() {
  const files = walk(join(root, "src"));
  const set = new Set();
  let useCache = 0;
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    useCache += (raw.match(/(['"])use cache\1/g) ?? []).length;
    if (!file.endsWith(".tsx") || /\.test\./.test(file)) continue;
    const src = stripComments(raw);
    for (const m of src.matchAll(THAI)) {
      const t = m[0].replace(/\s+/g, " ").trim();
      if (t) set.add(`text:${t}`);
    }
    for (const m of src.matchAll(TESTID)) set.add(`testid:${m[1] ?? m[2] ?? m[3] ?? m[4]}`);
    for (const m of src.matchAll(ARIA)) set.add(`aria:${m[1] ?? m[2] ?? m[3] ?? m[4]}`);
  }
  return { strings: [...set].sort(), useCache };
}

const { strings, useCache } = collect();

if (writeBaseline) {
  writeFileSync(baselineFile, [`use-cache-count:${useCache}`, ...strings].join("\n") + "\n");
  console.log(`baseline written: ${strings.length} strings, use-cache-count:${useCache}`);
  process.exit(0);
}

const problems = [];

// 1. forbidden paths
let changed = new Set();
try {
  changed = new Set([...git(["diff", "--name-only", "main...HEAD"]), ...git(["diff", "--name-only", "HEAD"]), ...git(["ls-files", "--others", "--exclude-standard"])]);
} catch (e) {
  problems.push(`git diff failed: ${e.message}`);
}
for (const p of changed) {
  if (FORBIDDEN_FILES.includes(p) || FORBIDDEN_PREFIXES.some((pre) => p.startsWith(pre))) problems.push(`forbidden path changed: ${p}`);
}

// 2. UI strings + 3. use cache
const baselineLines = readFileSync(baselineFile, "utf8").split(/\r?\n/).filter(Boolean);
const baselineCount = baselineLines.find((l) => l.startsWith("use-cache-count:"));
const baseline = new Set(baselineLines.filter((l) => !l.startsWith("use-cache-count:")));
const current = new Set(strings);
for (const s of baseline) if (!current.has(s)) problems.push(`missing from src: ${s}`);
for (const s of current) if (!baseline.has(s) && !ALLOWED_NEW.has(s)) problems.push(`new string not allowed: ${s}`);
if (!baselineCount) problems.push("baseline has no use-cache-count line");
else if (Number(baselineCount.split(":")[1]) !== useCache) problems.push(`'use cache' count ${useCache} != baseline ${baselineCount.split(":")[1]}`);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("scope OK");
