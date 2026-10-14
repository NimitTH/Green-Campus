import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("admin client is not importable from client bundle", () => {
  it('admin.ts starts with import "server-only"', () => {
    const firstCode = read("src/lib/supabase/admin.ts")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l !== "" && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));
    expect(firstCode).toBe('import "server-only";');
  });

  it(".env.example has no real secret values", () => {
    const env = read(".env.example");
    expect(env).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    const line = env.split("\n").find((l) => l.startsWith("SUPABASE_SECRET_KEY="));
    expect(line).toBeDefined();
    expect(line!.slice("SUPABASE_SECRET_KEY=".length).trim()).toMatch(/^$|^your-|^<|placeholder/i);
    expect(env).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{10,}/);
  });

  it("secret key is never referenced by browser or server-cookie clients", () => {
    expect(read("src/lib/supabase/browser.ts")).not.toMatch(/SUPABASE_SECRET_KEY/);
    expect(read("src/lib/supabase/server.ts")).not.toMatch(/SUPABASE_SECRET_KEY/);
  });
});
