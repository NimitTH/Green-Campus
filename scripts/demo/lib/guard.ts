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

/**
 * The project a Postgres URL points at: localhost -> `local`; the Supabase pooler user `postgres.<ref>`
 * -> `<ref>`; a direct host `db.<ref>.supabase.co` -> `<ref>`; anything else -> null.
 */
export function projectRefFromDbUrl(dbUrl: string | undefined): string | null {
  if (!dbUrl) return null;
  let u: URL;
  try {
    u = new URL(dbUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return null;
  const host = u.hostname.toLowerCase();
  const user = decodeURIComponent(u.username);
  if (LOCAL_HOSTS.has(host)) return "local";
  const pooler = /^postgres\.([a-z0-9]+)$/.exec(user);
  if (pooler) return pooler[1];
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host);
  return direct ? direct[1] : null;
}

export type GuardResult = { ok: true; ref: string } | { ok: false; message: string };

/** CONFIRM_PROJECT_REF must equal the ref of both NEXT_PUBLIC_SUPABASE_URL and DATABASE_URL. */
export function checkTarget(env: Record<string, string | undefined>): GuardResult {
  const apiRef = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const dbRef = projectRefFromDbUrl(env.DATABASE_URL);
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
  return { ok: true, ref: apiRef };
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
