import { describe, expect, it } from "vitest";
import {
  CALLBACK_PATHS,
  CALLBACK_TARGETS,
  emailRedirectUrl,
  isEmailChangePending,
  isRecoveryAmr,
  resolveSiteOrigin,
  rootAuthRedirect,
} from "./email-links";

describe("email redirect URLs", () => {
  it("are query-free callback URLs", () => {
    expect(emailRedirectUrl("http://localhost:3000", "signup")).toBe("http://localhost:3000/auth/callback");
    expect(emailRedirectUrl("http://localhost:3000", "reset")).toBe("http://localhost:3000/auth/callback/reset");
    expect(emailRedirectUrl("http://localhost:3000", "email")).toBe("http://localhost:3000/auth/callback/email");
    for (const path of Object.values(CALLBACK_PATHS)) expect(path).not.toContain("?");
  });
  it("callback targets are fixed same-site paths", () => {
    expect(CALLBACK_TARGETS.signup).toEqual({ success: "/dashboard", failure: "/login?error=link" });
    expect(CALLBACK_TARGETS.reset).toEqual({ success: "/reset-password", failure: "/forgot-password?error=link" });
    expect(CALLBACK_TARGETS.email).toEqual({ success: "/profile?email=changed", failure: "/profile?email=link-error" });
  });
});

describe("resolveSiteOrigin", () => {
  it("prefers the configured site URL (origin only)", () => {
    expect(resolveSiteOrigin({ configured: "http://localhost:3000/", origin: "http://127.0.0.1:3000" }))
      .toBe("http://localhost:3000");
    expect(resolveSiteOrigin({ configured: "https://app.example.com/x?y=1" })).toBe("https://app.example.com");
  });
  it("ignores an invalid configured value", () => {
    expect(resolveSiteOrigin({ configured: "javascript:alert(1)", origin: "http://localhost:3000" }))
      .toBe("http://localhost:3000");
    expect(resolveSiteOrigin({ configured: "not a url", host: "localhost:3000" })).toBe("http://localhost:3000");
  });
  it("falls back to the Origin header", () => {
    expect(resolveSiteOrigin({ origin: "https://green.example.com" })).toBe("https://green.example.com");
  });
  it("falls back to forwarded host/proto, then host", () => {
    expect(resolveSiteOrigin({ forwardedHost: "green.vercel.app", forwardedProto: "https", host: "internal:3000" }))
      .toBe("https://green.vercel.app");
    expect(resolveSiteOrigin({ host: "127.0.0.1:3000" })).toBe("http://127.0.0.1:3000");
    expect(resolveSiteOrigin({ host: "green.example.com" })).toBe("https://green.example.com");
  });
  it("rejects a malformed host and uses localhost", () => {
    expect(resolveSiteOrigin({ host: "evil.example/path" })).toBe("http://localhost:3000");
    expect(resolveSiteOrigin({})).toBe("http://localhost:3000");
  });
});

describe("isRecoveryAmr", () => {
  it("detects recovery in both amr formats", () => {
    expect(isRecoveryAmr([{ method: "recovery", timestamp: 1 }])).toBe(true);
    expect(isRecoveryAmr(["recovery"])).toBe(true);
  });
  it("is false otherwise", () => {
    expect(isRecoveryAmr([{ method: "password", timestamp: 1 }])).toBe(false);
    expect(isRecoveryAmr(["otp"])).toBe(false);
    expect(isRecoveryAmr(undefined)).toBe(false);
    expect(isRecoveryAmr("recovery")).toBe(false);
  });
});

describe("rootAuthRedirect", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("forwards /?code= to the callback", () => {
    expect(rootAuthRedirect("/", p("code=1b2c-3d4e"))).toBe("/auth/callback?code=1b2c-3d4e");
  });
  it("sends a malformed code or an auth error to the link-error page", () => {
    expect(rootAuthRedirect("/", p("code=%2F%2Fevil.example"))).toBe("/login?error=link");
    expect(rootAuthRedirect("/", p("code="))).toBe("/login?error=link");
    expect(rootAuthRedirect("/", p("error=access_denied&error_code=otp_expired"))).toBe("/login?error=link");
  });
  it("does nothing elsewhere or without auth params", () => {
    expect(rootAuthRedirect("/", p(""))).toBeNull();
    expect(rootAuthRedirect("/", p("utm=x"))).toBeNull();
    expect(rootAuthRedirect("/login", p("code=abc"))).toBeNull();
  });
  it("always returns a single-slash same-site path", () => {
    for (const q of ["code=abc", "code=//evil", "code=\thttps://evil", "error_code=x"]) {
      const out = rootAuthRedirect("/", p(q));
      expect(out).toMatch(/^\/(?!\/)/);
      expect(new URL(out!, "https://app.example").origin).toBe("https://app.example");
    }
  });
});

describe("isEmailChangePending", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("is true for the first double-confirm link: a message and no code", () => {
    expect(isEmailChangePending(p("message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email"))).toBe(true);
  });
  it("is false with a code, with an error, or with nothing", () => {
    expect(isEmailChangePending(p("code=abc&message=x"))).toBe(false);
    expect(isEmailChangePending(p("message=x&error=access_denied"))).toBe(false);
    expect(isEmailChangePending(p("message=x&error_code=otp_expired"))).toBe(false);
    expect(isEmailChangePending(p("message=x&error_description=bad"))).toBe(false);
    expect(isEmailChangePending(p(""))).toBe(false);
    expect(isEmailChangePending(p("message="))).toBe(false);
  });
});
