import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicArticleSummary } from "@/lib/articles/public";
import type { PublicActivity, PublicReward } from "@/lib/home/public-feed";
import { ActivitiesSection } from "./activities-section";
import { ArticlesSection } from "./articles-section";
import { RewardsSection } from "./rewards-section";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const NOW = new Date("2026-11-06T00:00+07:00");
const LONG = "ก".repeat(200);

const activity = (id: string, type: string, title = `กิจกรรม ${id}`): PublicActivity => ({
  id,
  title,
  type,
  startsAt: "2026-11-01T00:00+07:00",
  endsAt: "2026-11-11T00:00+07:00",
});
const reward = (id: string, name = `รางวัล ${id}`): PublicReward => ({ id, name, pointsCost: 120, stock: 8, imageUrl: null });
const article = (n: number, title = `บทความ ${n}`): PublicArticleSummary => ({
  id: `a${n}`,
  slug: `slug-${n}`,
  title,
  excerpt: "",
  coverUrl: null,
  createdAt: "2026-10-25T09:00:00Z",
});

describe("ActivitiesSection", () => {
  it("renders open activities as links with time progress", () => {
    const out = html(createElement(ActivitiesSection, { activities: [activity("x1", "waste"), activity("x2", "trees")], now: NOW }));
    expect(out).toContain("กิจกรรมที่เปิดรับอยู่");
    expect(out).toContain("ชั่งน้ำหนักขยะ");
    expect(out).toContain("ปลูกต้นไม้");
    expect(out).toContain("เหลือ");
    expect(out).toContain("ผ่านไป");
    expect(out).toContain("เข้าสู่ระบบเพื่อเข้าร่วม");
    expect(out).toContain('href="/activities/x1"');
    expect(out).toContain('href="/activities/x2"');
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="50"');
  });
  it("empty list keeps the heading and says so", () => {
    const out = html(createElement(ActivitiesSection, { activities: [], now: NOW }));
    expect(out).toContain("กิจกรรมที่เปิดรับอยู่");
    expect(out).toContain("ยังไม่มีกิจกรรมที่เปิดรับ");
  });
  it("failed load (null) says it cannot load", () => {
    const out = html(createElement(ActivitiesSection, { activities: null, now: NOW }));
    expect(out).toContain("กิจกรรมที่เปิดรับอยู่");
    expect(out).toContain("ยังโหลดกิจกรรมไม่ได้ในขณะนี้");
  });
  it("a long unbroken title wraps inside a shrinkable card", () => {
    const out = html(createElement(ActivitiesSection, { activities: [activity("x1", "fixed", LONG)], now: NOW }));
    expect(out).toMatch(new RegExp(`<h3[^>]*class="[^"]*break-words[^"]*"[^>]*>${LONG}</h3>`));
    expect(out).toContain("min-w-0");
  });
});

describe("RewardsSection", () => {
  it("hides the whole section when empty or not loaded", () => {
    expect(html(createElement(RewardsSection, { rewards: [] }))).toBe("");
    expect(html(createElement(RewardsSection, { rewards: null }))).toBe("");
  });
  it("renders a reward with price tag, stock and sign-in hint", () => {
    const out = html(createElement(RewardsSection, { rewards: [reward("r1")] }));
    expect(out).toContain("แต้มของคุณ แลกอะไรได้บ้าง");
    expect(out).toContain('<span class="font-mono">120</span> แต้ม');
    expect(out).toContain("เหลือ ");
    expect(out).toContain('<span class="font-mono">8</span> ชิ้น');
    expect(out).toContain("เข้าสู่ระบบเพื่อแลก");
    expect(out).toContain('href="/rewards"');
  });
  it("a long unbroken name wraps inside a shrinkable card", () => {
    const out = html(createElement(RewardsSection, { rewards: [reward("r1", LONG)] }));
    expect(out).toMatch(new RegExp(`<h3[^>]*class="[^"]*break-words[^"]*"[^>]*>${LONG}</h3>`));
    expect(out).toContain("min-w-0");
  });
});

describe("ArticlesSection", () => {
  it("shows the newest four and links to all articles", () => {
    const out = html(createElement(ArticlesSection, { articles: [1, 2, 3, 4, 5, 6].map((n) => article(n)) }));
    expect(out).toContain("บทความล่าสุด");
    for (const n of [1, 2, 3, 4]) expect(out).toContain(`href="/articles/slug-${n}"`);
    expect(out).not.toContain('href="/articles/slug-5"');
    expect(out).not.toContain('href="/articles/slug-6"');
    expect(out).toMatch(/<a[^>]*href="\/articles"[^>]*>ดูบทความทั้งหมด →<\/a>/);
  });
  it("hides the whole section when empty or not loaded", () => {
    expect(html(createElement(ArticlesSection, { articles: [] }))).toBe("");
    expect(html(createElement(ArticlesSection, { articles: null }))).toBe("");
  });
  it("a long unbroken title wraps inside a shrinkable card", () => {
    const out = html(createElement(ArticlesSection, { articles: [article(1, LONG)] }));
    expect(out).toMatch(new RegExp(`<h3[^>]*class="[^"]*break-words[^"]*"[^>]*>${LONG}</h3>`));
    expect(out).toContain("min-w-0");
  });
});
