import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn(async () => {}) }));

const { HeaderAccountView } = await import("./header-account");
const { MAIN_NAV_ITEMS } = await import("./main-nav");

type ViewUser = Parameters<typeof HeaderAccountView>[0]["user"];

const html = (user: ViewUser) => renderToStaticMarkup(createElement(HeaderAccountView, { user }));
const person = (role: "student" | "teacher" | "admin"): ViewUser => ({
  role,
  fullName: "สมชาย ใจดี",
  displayName: null,
  email: "somchai@example.com",
  avatarUrl: null,
});

describe("HeaderAccountView", () => {
  it("anonymous: login and register links, no old combined link, no student nav", () => {
    const out = html(null);
    expect(out).toMatch(/<a[^>]*href="\/login"[^>]*>เข้าสู่ระบบ<\/a>/);
    expect(out).toMatch(/<a[^>]*href="\/register"[^>]*>สมัครสมาชิก<\/a>/);
    expect(out).not.toContain("เข้าสู่ระบบ / หน้าของฉัน");
    expect(out).not.toContain("หน้าหลัก");
    expect(out).toContain('aria-label="ธีม"');
    expect(out).not.toContain("เมนูบัญชี");
  });

  it("student: the six centre items, the account menu, no ฉัน", () => {
    const out = html(person("student"));
    expect(MAIN_NAV_ITEMS.map((i) => i.label)).toEqual(["หน้าหลัก", "กิจกรรม", "ผลที่ส่ง", "รางวัล", "อันดับ", "บทความ"]);
    for (const item of MAIN_NAV_ITEMS) expect(out).toContain(`href="${item.href}"`);
    for (const item of MAIN_NAV_ITEMS) expect(out).toContain(`>${item.label}<`);
    expect(out).toContain('aria-label="เมนูหลัก"');
    expect(out).toContain('aria-label="เมนูบัญชี"');
    expect(out).not.toContain(">ฉัน<");
    expect(out).toContain('href="/profile"');
    expect(out).toContain("somchai@example.com");
    expect(out).toContain("ออกจากระบบ");
  });

  it("student: the menu shows the display name when there is one", () => {
    const out = html({ ...person("student")!, displayName: "ชายเล่น" });
    expect(out).toContain("ชายเล่น");
  });

  it("account menu button points at a hidden panel by id", () => {
    const out = html(person("student"));
    const controls = out.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(out).toContain(`id="${controls}"`);
    expect(out).toContain('aria-expanded="false"');
  });

  for (const role of ["teacher", "admin"] as const) {
    it(`${role}: staff links, no student centre nav`, () => {
      const out = html(person(role));
      expect(out).not.toContain("ผลที่ส่ง");
      expect(out).not.toContain('aria-label="เมนูหลัก"');
      expect(out).toMatch(/<a[^>]*href="\/staff"[^>]*>หน้าผู้ดูแล<\/a>/);
      expect(out).toMatch(/<a[^>]*href="\/staff\/profile"[^>]*>โปรไฟล์<\/a>/);
      expect(out).not.toContain('href="/profile"');
      expect(out).toContain('aria-label="เมนูบัญชี"');
    });
  }
});
