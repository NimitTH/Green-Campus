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

// Redesign 3 (DESIGN-3 1.2): src/lib/, src/app/actions/, src/app/auth/ and supabase/config.toml may change; supabase/migrations/
// and supabase/tests/ accept NEW files only (a modified, deleted or renamed existing file is still forbidden, see below).
const FORBIDDEN_PREFIXES = ["src/app/api/", "scripts/"];
const NEW_ONLY_PREFIXES = ["supabase/migrations/", "supabase/tests/"];
const FORBIDDEN_FILES = ["src/proxy.ts"];
// Redesign 4 (controller ruling): DESIGN-4 3.1/7.1 reverses "students cannot delete notifications", so this ONE existing test
// file may be modified. Every other existing migration/test still fails when modified or deleted.
const MODIFIED_TEST_ALLOWLIST = new Set(["supabase/tests/notifications.test.sql"]);
// Redesign 4: new files under src/app/auth/signout/ and src/app/(auth)/change-password/ are allowed (not forbidden prefixes).
// Only these files may import @/lib/supabase/admin.
const ADMIN_IMPORT_OK = new Set([
  "src/app/actions/accounts.ts",
  "src/app/api/cron/cleanup-orphans/route.ts",
  "src/app/api/cron/cleanup-orphans/route.test.ts",
  "src/lib/supabase/server.test.ts",
]);
const ALLOWED_NEW = new Set(["text:ธีม", "text:สว่าง", "text:มืด", "text:ตามระบบ", "aria:ธีม"]);
const REMOVED_OK = new Set();
for (const [file, set] of [["ui-strings-2.allow.txt", ALLOWED_NEW], ["ui-strings-3.allow.txt", ALLOWED_NEW], ["ui-strings-3.removed.txt", REMOVED_OK], ["ui-strings-4.allow.txt", ALLOWED_NEW], ["ui-strings-4.removed.txt", REMOVED_OK]]) {
  let txt = "";
  try { txt = readFileSync(join(here, file), "utf8"); } catch { /* optional file */ }
  for (const l of txt.split(/\r?\n/)) if (/^(text|aria):/.test(l.trim())) set.add(l.trim());
}

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
const touchedExisting = new Set(); // files that were modified (M), deleted (D), renamed or type-changed, i.e. not purely added
try {
  changed = new Set([...git(["diff", "--name-only", "main...HEAD"]), ...git(["diff", "--name-only", "HEAD"]), ...git(["ls-files", "--others", "--exclude-standard"])]);
  for (const range of ["main...HEAD", "HEAD"]) {
    for (const line of git(["diff", "--name-status", range])) {
      const [status, ...paths] = line.split("\t");
      if (status !== "A") for (const p of paths) touchedExisting.add(p);
    }
  }
} catch (e) {
  problems.push(`git diff failed: ${e.message}`);
}
for (const p of changed) {
  if (FORBIDDEN_FILES.includes(p) || FORBIDDEN_PREFIXES.some((pre) => p.startsWith(pre))) problems.push(`forbidden path changed: ${p}`);
}
for (const p of touchedExisting) {
  if (NEW_ONLY_PREFIXES.some((pre) => p.startsWith(pre)) && !MODIFIED_TEST_ALLOWLIST.has(p)) problems.push(`existing migration/test modified or deleted: ${p}`);
}

// 1b. admin client imports
for (const file of walk(join(root, "src"))) {
  const rel = file.slice(root.length + 1).split("\\").join("/");
  if (ADMIN_IMPORT_OK.has(rel) || !/\.(ts|tsx|mts|js|mjs)$/.test(rel)) continue;
  if (/(?:from|import\(|vi\.mock\()\s*["']@\/lib\/supabase\/admin["']/.test(readFileSync(file, "utf8"))) problems.push(`forbidden import of @/lib/supabase/admin: ${rel}`);
}

// 2. UI strings + 3. use cache
const baselineLines = readFileSync(baselineFile, "utf8").split(/\r?\n/).filter(Boolean);
const baselineCount = baselineLines.find((l) => l.startsWith("use-cache-count:"));
const baseline = new Set(baselineLines.filter((l) => !l.startsWith("use-cache-count:")));
const current = new Set(strings);
for (const s of baseline) if (!current.has(s) && !REMOVED_OK.has(s)) problems.push(`missing from src: ${s}`);
for (const s of current) if (!baseline.has(s) && !ALLOWED_NEW.has(s)) problems.push(`new string not allowed: ${s}`);
if (!baselineCount) problems.push("baseline has no use-cache-count line");
else if (Number(baselineCount.split(":")[1]) !== useCache) problems.push(`'use cache' count ${useCache} != baseline ${baselineCount.split(":")[1]}`);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("scope OK");
