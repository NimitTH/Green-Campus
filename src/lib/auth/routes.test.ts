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
  it.each(["/dashboard", "/dashboard/x", "/staff", "/staff/users", "/staff/reviews/1"])(
    "%s needs a signed-in user",
    (p) => expect(isProtectedPath(p)).toBe(true),
  );
  it.each(["/", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback", "/staffroom", "/dashboards"])(
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
  it("uses the given fallback", () => {
    expect(safeNextPath(null, "/reset-password")).toBe("/reset-password");
  });
});

describe("loginPathFor", () => {
  it("encodes the return path", () => {
    expect(loginPathFor("/staff?tab=a&b=1")).toBe("/login?next=%2Fstaff%3Ftab%3Da%26b%3D1");
  });
});
