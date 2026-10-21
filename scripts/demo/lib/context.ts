import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { checkDemoPassword, checkTarget, refuse } from "./guard.ts";

// Shared setup of the three demo scripts: load .env.local, run the R136 guard BEFORE any connection is
// opened, then create the Auth/Storage admin client (secret key) and the pg client (DATABASE_URL).

export const SEED_DOMAIN = "seed.greencampus.example";
export const SEED_EMAIL_SUFFIX = `@${SEED_DOMAIN}`;
export const DEMO_EMAILS = {
  student: `demo-student${SEED_EMAIL_SUFFIX}`,
  teacher: `demo-teacher${SEED_EMAIL_SUFFIX}`,
  admin: `demo-admin${SEED_EMAIL_SUFFIX}`,
} as const;
/** Prefix of seed activity titles and reward names (R137). Seed article slugs start with `seed-`. */
export const SEED_PREFIX = "[ตัวอย่าง] ";
export const SEED_SLUG_PREFIX = "seed-";

export type Ctx = {
  ref: string;
  admin: SupabaseClient;
  db: pg.Client;
  demoPassword: string;
  log: (msg: string) => void;
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Guard first; exits 1 with a Thai + English message (stderr) before anything is touched. */
export async function openContext(opts: { needDemoPassword: boolean }): Promise<Ctx> {
  // CONFIRM_PROJECT_REF counts only when typed for this run (shell / CI env), never from an .env file:
  // read it before the files are loaded, so a value left in .env.local cannot confirm a target.
  const confirm = process.env.CONFIRM_PROJECT_REF;
  // .env.local etc. never override variables already set in the environment
  nextEnv.loadEnvConfig(PROJECT_ROOT, false, { info: () => {}, error: console.error });
  const env = process.env;

  const target = checkTarget({ ...env, CONFIRM_PROJECT_REF: confirm });
  if (!target.ok) refuse(target.message);
  if (opts.needDemoPassword) {
    const pw = checkDemoPassword(env.DEMO_PASSWORD);
    if (!pw.ok) refuse(pw.message);
  }
  if (!env.SUPABASE_SECRET_KEY) {
    refuse(
      "ไม่รัน: ต้องตั้ง SUPABASE_SECRET_KEY (secret key ของโปรเจกต์ ใช้กับ Auth admin และ Storage)\n" +
        "Refusing to run: SUPABASE_SECRET_KEY is required (Auth admin + Storage). Nothing was changed.",
    );
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // R141: pg gets exactly the fields the guard checked, never the raw string (whose ?host=/?user= would win)
  const db = new pg.Client({ ...target.db, application_name: "green-campus-demo-scripts" });
  await db.connect();
  return {
    ref: target.ref,
    admin,
    db,
    demoPassword: env.DEMO_PASSWORD ?? "",
    log: (msg) => console.log(msg),
  };
}

/** Run `main`, close the connection, and exit non-zero on any error (message only: no secrets in it). */
export async function runScript(main: () => Promise<void>, ctxRef: { ctx?: Ctx }): Promise<void> {
  try {
    await main();
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error(`ล้มเหลว / Failed: ${err.code ? `[${err.code}] ` : ""}${err.message ?? String(e)}`);
    process.exitCode = 1;
  } finally {
    await ctxRef.ctx?.db.end().catch(() => {});
  }
}
