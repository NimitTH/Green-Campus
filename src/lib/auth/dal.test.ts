import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

type Row = Record<string, unknown> | null;
const state: { user: { id: string; email: string } | null; error: { code?: string } | null; row: Row } = {
  user: null,
  error: null,
  row: null,
};
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.error }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }) }),
    }),
  })),
}));

const { accessDecision, assertActiveUser, getCurrentUser, requireUser } = await import("./dal");

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
