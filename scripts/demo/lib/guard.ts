// R136 safety guard shared by seed.ts, reset-demo.ts and purge-users.ts.
// Pure functions first (tested by tests/seed/seed.spec.ts), then the process-level checks.
// Never print secrets, passwords, e-mails or ids: only project refs (they are part of the URL) and counts.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** `https://<ref>.supabase.co` -> `<ref>`, localhost / 127.0.0.1 -> `local`, anything else -> null. */
export function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return "local";
  const m = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
  return m ? m[1] : null;
}

/** The pg connection config built from the checked URL fields (R141): pg never parses the raw string. */
export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | { rejectUnauthorized: boolean };
};

export type ParsedDbUrl = { ok: true; ref: string | null; config: DbConfig } | { ok: false; reason: string };

// The only query parameter accepted. pg (pg-connection-string) lets ?host=, ?user=, ?hostaddr=, ?port=,
// ?options=, ... override the URL parts, so every other parameter is refused (R141).
const SSL_MODES: Record<string, DbConfig["ssl"]> = {
  disable: false,
  prefer: { rejectUnauthorized: false },
  require: { rejectUnauthorized: false },
  "no-verify": { rejectUnauthorized: false },
  "verify-ca": { rejectUnauthorized: true },
  "verify-full": { rejectUnauthorized: true },
};
const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$|^\[::1\]$/;

/**
 * Parse DATABASE_URL strictly: postgres(ql) scheme, one plain host name (no list, no socket path), optional
 * port, a database name, and no query parameter except sslmode. The project it points at: localhost ->
 * `local`; the Supabase pooler user `postgres.<ref>` -> `<ref>`; a direct host `db.<ref>.supabase.co` ->
 * `<ref>`; otherwise ref null. Without sslmode: no TLS locally, TLS (no certificate check) elsewhere.
 */
export function parseDbUrl(dbUrl: string | undefined): ParsedDbUrl {
  if (!dbUrl) return { ok: false, reason: "DATABASE_URL is not set" };
  let u: URL;
  try {
    u = new URL(dbUrl);
  } catch {
    return { ok: false, reason: "DATABASE_URL is not a valid URL" };
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return { ok: false, reason: "scheme must be postgres:// or postgresql://" };
  const host = u.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "DATABASE_URL has no host" };
  if (!HOST_RE.test(host)) return { ok: false, reason: "DATABASE_URL host must be one plain host name" };
  if (u.hash) return { ok: false, reason: "DATABASE_URL must not have a #fragment" };
  let ssl: DbConfig["ssl"] | undefined;
  for (const [key, value] of u.searchParams) {
    if (key !== "sslmode" || ssl !== undefined) return { ok: false, reason: `query parameter "${key}" is not allowed (only sslmode)` };
    if (!(value in SSL_MODES)) return { ok: false, reason: "unknown sslmode" };
    ssl = SSL_MODES[value];
  }
  let user: string;
  let password: string;
  let database: string;
  try {
    user = decodeURIComponent(u.username);
    password = decodeURIComponent(u.password);
    database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  } catch {
    return { ok: false, reason: "DATABASE_URL has a bad %-escape" };
  }
  if (!user) return { ok: false, reason: "DATABASE_URL has no user" };
  if (!database || database.includes("/")) return { ok: false, reason: "DATABASE_URL must name one database" };
  const port = u.port ? Number(u.port) : 5432;
  const local = LOCAL_HOSTS.has(host);
  const pooler = /^postgres\.([a-z0-9]+)$/.exec(user);
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host);
  const ref = local ? "local" : pooler ? pooler[1] : direct ? direct[1] : null;
  return {
    ok: true,
    ref,
    config: { host, port, user, password, database, ssl: ssl ?? (local ? false : { rejectUnauthorized: false }) },
  };
}

/** The project ref of a DATABASE_URL, or null when it is refused or points elsewhere. */
export function projectRefFromDbUrl(dbUrl: string | undefined): string | null {
  const p = parseDbUrl(dbUrl);
  return p.ok ? p.ref : null;
}

export type GuardResult = { ok: true; ref: string; db: DbConfig } | { ok: false; message: string };

/** CONFIRM_PROJECT_REF must equal the ref of both NEXT_PUBLIC_SUPABASE_URL and DATABASE_URL. */
export function checkTarget(env: Record<string, string | undefined>): GuardResult {
  const apiRef = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const parsed = parseDbUrl(env.DATABASE_URL);
  const dbRef = parsed.ok ? parsed.ref : null;
  const confirm = env.CONFIRM_PROJECT_REF ?? "";
  if (!apiRef) {
    return {
      ok: false,
      message:
        "ไม่รัน: อ่าน project ref จาก NEXT_PUBLIC_SUPABASE_URL ไม่ได้ (ต้องเป็น https://<ref>.supabase.co หรือ localhost)\n" +
        "Refusing to run: cannot derive a project ref from NEXT_PUBLIC_SUPABASE_URL (expected https://<ref>.supabase.co or localhost). " +
        "Nothing was changed. (CONFIRM_PROJECT_REF is checked against it.)",
    };
  }
  if (!parsed.ok) {
    return {
      ok: false,
      message:
        `ไม่รัน: DATABASE_URL ใช้ไม่ได้ (${parsed.reason}) ห้ามมีพารามิเตอร์อื่นนอกจาก sslmode\n` +
        `Refusing to run: DATABASE_URL is refused (${parsed.reason}). Only ?sslmode= is allowed. Nothing was changed. ` +
        "(CONFIRM_PROJECT_REF is checked against it.)",
    };
  }
  if (!dbRef) {
    return {
      ok: false,
      message:
        "ไม่รัน: อ่าน project ref จาก DATABASE_URL ไม่ได้ (ผู้ใช้ postgres.<ref> ของ pooler, โฮสต์ db.<ref>.supabase.co หรือ localhost)\n" +
        "Refusing to run: cannot derive a project ref from DATABASE_URL (pooler user postgres.<ref>, host db.<ref>.supabase.co, or localhost). " +
        "Nothing was changed. (CONFIRM_PROJECT_REF is checked against it.)",
    };
  }
  if (apiRef !== dbRef) {
    return {
      ok: false,
      message:
        `ไม่รัน: NEXT_PUBLIC_SUPABASE_URL ชี้โปรเจกต์ "${apiRef}" แต่ DATABASE_URL ชี้ "${dbRef}" ต้องเป็นโปรเจกต์เดียวกัน\n` +
        `Refusing to run: NEXT_PUBLIC_SUPABASE_URL is project "${apiRef}" but DATABASE_URL is "${dbRef}". Nothing was changed. ` +
        "(CONFIRM_PROJECT_REF must match both.)",
    };
  }
  if (confirm !== apiRef) {
    return {
      ok: false,
      message:
        `ไม่รัน: ต้องตั้ง CONFIRM_PROJECT_REF=${apiRef} ให้ตรงกับโปรเจกต์ปลายทาง (ตอนนี้ ${confirm === "" ? "ไม่ได้ตั้ง" : `"${confirm}"`})\n` +
        `Refusing to run: set CONFIRM_PROJECT_REF=${apiRef} to confirm the target project (got ${confirm === "" ? "nothing" : `"${confirm}"`}). ` +
        "Nothing was changed.",
    };
  }
  return { ok: true, ref: apiRef, db: parsed.config };
}

export const MIN_DEMO_PASSWORD_LENGTH = 12;

/** DEMO_PASSWORD is required for the scripts that create the demo accounts. Never echoed. */
export function checkDemoPassword(pw: string | undefined): { ok: true } | { ok: false; message: string } {
  if (!pw || pw.length < MIN_DEMO_PASSWORD_LENGTH) {
    return {
      ok: false,
      message:
        `ไม่รัน: ต้องตั้ง DEMO_PASSWORD (อย่างน้อย ${MIN_DEMO_PASSWORD_LENGTH} ตัวอักษร) สำหรับบัญชีสาธิต 3 บัญชี\n` +
        `Refusing to run: DEMO_PASSWORD is required (at least ${MIN_DEMO_PASSWORD_LENGTH} characters) for the 3 demo accounts. Nothing was changed.`,
    };
  }
  return { ok: true };
}

/** Print the message on stderr and exit 1 (nothing has been touched yet). */
export function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}
