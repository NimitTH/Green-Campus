import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

type Row = Record<string, unknown> | null;
const state: {
  user: { id: string; email: string } | null;
  error: { code?: string; name?: string } | null;
  row: Row;
  // the cookie session (unverified) and the caller's own account_status row, for a revoked session
  cookieUserId: string | null;
  statusRow: Row;
} = {
  user: null,
  error: null,
  row: null,
  cookieUserId: null,
  statusRow: null,
};
/** A JWT-shaped token with only a payload (the DAL reads sub; PostgREST would verify it). */
function fakeJwt(sub: string): string {
  return ["h", Buffer.from(JSON.stringify({ sub })).toString("base64url"), "s"].join(".");
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: state.error }),
      getSession: async () => ({ data: { session: state.cookieUserId ? { access_token: fakeJwt(state.cookieUserId) } : null }, error: null }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          const query = {
            maybeSingle: async () => ({ data: table === "account_status" ? state.statusRow : state.row, error: null }),
            setHeader: () => query,
          };
          return query;
        },
      }),
    }),
  })),
}));

const { accessDecision, assertActiveUser, getActiveUser, getCurrentUser, requireUser } = await import("./dal");

const NOW = new Date("2026-11-11T10:00:00Z");
const active = { suspendedUntil: null, mustChangePassword: false };

describe("accessDecision", () => {
  it("no user -> signin", () => {
    expect(accessDecision(null, NOW, "/dashboard")).toBe("signin");
  });
  it("suspended until a future time -> suspended", () => {
    expect(accessDecision({ ...active, suspendedUntil: "2026-11-12T10:00:00+00:00" }, NOW, "/dashboard")).toBe("suspended");
  });
  it("a suspension in the past -> ok", () => {
    expect(accessDecision({ ...active, suspendedUntil: "2026-11-10T10:00:00+00:00" }, NOW, "/dashboard")).toBe("ok");
  });
  it("a suspension ending exactly now is over -> ok", () => {
    expect(accessDecision({ ...active, suspendedUntil: NOW.toISOString() }, NOW, "/dashboard")).toBe("ok");
  });
  it('"infinity" (until lifted) -> suspended', () => {
    expect(accessDecision({ ...active, suspendedUntil: "infinity" }, NOW, "/dashboard")).toBe("suspended");
  });
  it("an unreadable suspension value fails closed -> suspended", () => {
    expect(accessDecision({ ...active, suspendedUntil: "not-a-date" }, NOW, "/dashboard")).toBe("suspended");
  });
  it("must change password at /dashboard -> change_password", () => {
    expect(accessDecision({ ...active, mustChangePassword: true }, NOW, "/dashboard")).toBe("change_password");
  });
  it("must change password at /change-password -> ok", () => {
    expect(accessDecision({ ...active, mustChangePassword: true }, NOW, "/change-password")).toBe("ok");
  });
  it("suspension wins over the password flag, even on /change-password", () => {
    const user = { suspendedUntil: "infinity", mustChangePassword: true };
    expect(accessDecision(user, NOW, "/change-password")).toBe("suspended");
  });
  it("an active user -> ok", () => {
    expect(accessDecision(active, NOW, "/staff")).toBe("ok");
  });
});

const profile = (status: Row) => ({
  role: "student",
  full_name: "สมชาย ใจดี",
  display_name: null,
  avatar_path: null,
  account_status: status,
});

describe("getCurrentUser / requireUser / assertActiveUser", () => {
  beforeEach(() => {
    state.user = { id: "11111111-1111-4111-8111-111111111111", email: "s@example.test" };
    state.error = null;
    state.row = profile(null);
  });

  it("a user without a status row is active", async () => {
    const user = await getCurrentUser();
    expect(user).toMatchObject({ role: "student", suspendedUntil: null, mustChangePassword: false });
    await expect(requireUser()).resolves.toMatchObject({ id: state.user!.id });
    await expect(assertActiveUser()).resolves.toMatchObject({ id: state.user!.id });
  });

  it("a suspended user is signed out everywhere: getCurrentUser null, requireUser -> /auth/signout", async () => {
    state.row = profile({ suspended_until: "infinity", must_change_password: false });
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser("/cart")).rejects.toThrow("REDIRECT:/auth/signout?reason=suspended");
    await expect(assertActiveUser()).rejects.toThrow("REDIRECT:/auth/signout?reason=suspended");
  });

  it("Auth refusing a banned user counts as suspended", async () => {
    state.user = null;
    state.error = { code: "user_banned" };
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser()).rejects.toThrow("REDIRECT:/auth/signout?reason=suspended");
  });

  it("an expired suspension is ignored", async () => {
    state.row = profile({ suspended_until: "2000-01-01T00:00:00+00:00", must_change_password: false });
    expect(await getCurrentUser()).toMatchObject({ suspendedUntil: "2000-01-01T00:00:00+00:00" });
  });

  it("must change password: requireUser -> /change-password except on that page; actions are refused", async () => {
    state.row = profile({ suspended_until: null, must_change_password: true });
    expect(await getCurrentUser()).toMatchObject({ mustChangePassword: true });
    await expect(requireUser("/dashboard")).rejects.toThrow("REDIRECT:/change-password");
    await expect(requireUser("/change-password")).resolves.toMatchObject({ mustChangePassword: true });
    await expect(assertActiveUser()).rejects.toThrow("must_change_password");
  });

  it("anonymous: requireUser and assertActiveUser -> /login with next", async () => {
    state.user = null;
    await expect(requireUser("/cart")).rejects.toThrow("REDIRECT:/login?next=%2Fcart");
    await expect(assertActiveUser("/staff/students")).rejects.toThrow("REDIRECT:/login?next=%2Fstaff%2Fstudents");
  });
});

// Review M5 (Task 16): the non-throwing gate for new server actions, so the suspended / must-change checks are not copied.
describe("getActiveUser", () => {
  beforeEach(() => {
    state.user = { id: "22222222-2222-4222-8222-222222222222", email: "t@example.test" };
    state.error = null;
    state.row = { ...profile(null), role: "teacher" };
  });

  it("an active user -> ok with the user", async () => {
    await expect(getActiveUser()).resolves.toMatchObject({ ok: true, user: { id: state.user!.id, role: "teacher" } });
  });

  it("anonymous -> not_authenticated (no redirect, no throw)", async () => {
    state.user = null;
    await expect(getActiveUser()).resolves.toEqual({ ok: false, code: "not_authenticated" });
  });

  it("suspended (status row or Auth ban) -> not_authenticated", async () => {
    state.row = { ...profile({ suspended_until: "infinity", must_change_password: false }), role: "teacher" };
    await expect(getActiveUser()).resolves.toEqual({ ok: false, code: "not_authenticated" });
    state.user = null;
    state.error = { code: "user_banned" };
    await expect(getActiveUser()).resolves.toEqual({ ok: false, code: "not_authenticated" });
  });

  it("a pending password change -> must_change_password", async () => {
    state.row = { ...profile({ suspended_until: null, must_change_password: true }), role: "teacher" };
    await expect(getActiveUser()).resolves.toEqual({ ok: false, code: "must_change_password" });
  });
});

// Review I2 / ruling R15: reset and suspend delete the student's auth.sessions, so Auth answers session_not_found
// for the open tab instead of user_banned. The page must still say "suspended" (spec 6.4), not just "sign in".
describe("a revoked session (session_not_found)", () => {
  beforeEach(() => {
    state.user = null;
    state.error = { code: "session_not_found" };
    state.row = null;
    state.cookieUserId = "33333333-3333-4333-8333-333333333333";
    state.statusRow = null;
  });

  it("of a suspended student -> suspended: requireUser goes to /auth/signout", async () => {
    state.statusRow = { suspended_until: "infinity" };
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser("/notifications")).rejects.toThrow("REDIRECT:/auth/signout?reason=suspended");
  });

  it("as supabase-js reports it (AuthSessionMissingError, no code) -> still suspended", async () => {
    state.error = { name: "AuthSessionMissingError" };
    state.statusRow = { suspended_until: "infinity" };
    await expect(requireUser("/notifications")).rejects.toThrow("REDIRECT:/auth/signout?reason=suspended");
  });

  it("after a reset (not suspended) -> just signed out: /login with next", async () => {
    state.statusRow = { suspended_until: null };
    await expect(requireUser("/dashboard")).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
  });

  it("an expired suspension or no status row -> signed out, not suspended", async () => {
    state.statusRow = { suspended_until: "2000-01-01T00:00:00+00:00" };
    await expect(requireUser("/dashboard")).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
    state.statusRow = null;
    await expect(requireUser("/dashboard")).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
  });

  it("no cookie session -> signed out", async () => {
    state.cookieUserId = null;
    state.statusRow = { suspended_until: "infinity" };
    await expect(requireUser("/dashboard")).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
  });

  it("other Auth errors are not looked up", async () => {
    state.error = { code: "bad_jwt" };
    state.statusRow = { suspended_until: "infinity" };
    await expect(requireUser("/dashboard")).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
  });
});
