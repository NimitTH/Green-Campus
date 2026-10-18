import { describe, expect, it } from "vitest";
import {
  isAdminRole,
  isProtectedPath,
  isStaffRole,
  loginPathFor,
  safeNextPath,
  toRole,
} from "./routes";

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/dashboard/x", "/staff", "/staff/users", "/staff/reviews/1", "/activities", "/activities/abc", "/activities/abc/submit", "/my-submissions"])(
    "%s needs a signed-in user",
    (p) => expect(isProtectedPath(p)).toBe(true),
  );
  it.each(["/", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback", "/staffroom", "/dashboards", "/activitiesx"])(
    "%s is public",
    (p) => expect(isProtectedPath(p)).toBe(false),
  );
});

describe("roles", () => {
  it("toRole accepts only the three roles", () => {
    expect(toRole("student")).toBe("student");
    expect(toRole("teacher")).toBe("teacher");
    expect(toRole("admin")).toBe("admin");
    expect(toRole("superuser")).toBeNull();
    expect(toRole(undefined)).toBeNull();
  });
  it("staff = teacher or admin", () => {
    expect(isStaffRole("student")).toBe(false);
    expect(isStaffRole("teacher")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole(null)).toBe(false);
  });
  it("admin only for admin", () => {
    expect(isAdminRole("teacher")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/staff/reviews?x=1")).toBe("/staff/reviews?x=1");
  });
  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "dashboard"])(
    "falls back for %s",
    (n) => expect(safeNextPath(n)).toBe("/dashboard"),
  );
  it.each(["/\t/evil.example", "/\n/evil.example", "/\t\\evil.example", "/\r/evil.example", "/ /evil.example", "/\\evil.example", "/x\\..\\\\evil.example",
    "/a/..//evil.example", "/..//evil.example", "/.//evil.example", "/%2e%2e//evil", "/a/%2e%2e//evil.example"])(
    "blocks tab/newline/backslash open redirect %j",
    (n) => expect(safeNextPath(n)).toBe("/dashboard"),
  );
  it("keeps an encoded tab as a same-origin path", () => {
    const result = safeNextPath("/%09/evil.example");
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
    expect(new URL(result, "https://app.example").origin).toBe("https://app.example");
  });
  it("normalises dot segments without leaving the site", () => {
    expect(safeNextPath("/staff/../dashboard?x=1#h")).toBe("/dashboard?x=1#h");
  });
  it("never returns anything but a single-slash same-site path or the fallback", () => {
    const inputs = [
      "/a/..//evil.example", "/..//evil.example", "/.//evil.example", "/%2e%2e//evil",
      "/a/%2e%2e//evil.example", "/\t/evil.example", "/\n/evil.example", "/\t\\evil.example",
      "/\r/evil.example", "/ /evil.example", "//evil.example", "/\\evil.example",
      "https://evil.example", "/%09/evil.example", "/%2f/evil.example", "/staff/../dashboard",
      "/dashboard?next=//evil", "/staff#//evil", "/./staff", "/a/b/../../..//evil", "/\u0000/x",
    ];
    const FALLBACK = "/fallback-marker";
    for (const input of inputs) {
      const out = safeNextPath(input, FALLBACK);
      if (out === FALLBACK) continue;
      expect(out, input).toMatch(/^\/(?!\/)/);
      expect(out, input).not.toMatch(/[\\\x00-\x1F\x7F]/);
    }
  });
  it("uses the given fallback", () => {
    expect(safeNextPath(null, "/reset-password")).toBe("/reset-password");
  });
});

describe("loginPathFor", () => {
  it("encodes the return path", () => {
    expect(loginPathFor("/staff?tab=a&b=1")).toBe("/login?next=%2Fstaff%3Ftab%3Da%26b%3D1");
  });
});
