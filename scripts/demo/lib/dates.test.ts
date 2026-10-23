import { describe, expect, it } from "vitest";
import { bangkokMonthStart, currentMonthSlot } from "./dates.ts";

// Fix round 1 (M5): current-month seed results always land in [month start, now) (Bangkok).

const at = (iso: string) => Date.parse(iso);
const DAY = 24 * 60 * 60_000;

describe("bangkokMonthStart", () => {
  it("uses the Bangkok calendar (UTC+7)", () => {
    expect(new Date(bangkokMonthStart(at("2026-10-31T17:30:00Z"))).toISOString()).toBe("2026-10-31T17:00:00.000Z"); // 1 Nov 00:30
    expect(new Date(bangkokMonthStart(at("2026-10-31T16:59:00Z"))).toISOString()).toBe("2026-09-30T17:00:00.000Z"); // 31 Oct 23:59
    expect(new Date(bangkokMonthStart(at("2026-12-31T18:00:00Z"))).toISOString()).toBe("2026-12-31T17:00:00.000Z"); // 1 Jan 01:00
  });
});

describe("currentMonthSlot", () => {
  const inWindow = (now: number, notBefore: number) => {
    const monthStart = bangkokMonthStart(now);
    for (const frac of [0, 0.25, 0.5, 0.99, 1]) {
      const { created, reviewed } = currentMonthSlot(now, notBefore, frac);
      expect(created).toBeGreaterThanOrEqual(Math.max(monthStart, Math.min(notBefore, now)));
      expect(reviewed).toBeGreaterThanOrEqual(created);
      expect(reviewed).toBeLessThanOrEqual(now - 1000);
      expect(created).toBeLessThan(now);
    }
  };

  it("00:00:30 on the 1st (Bangkok): a few seconds after the month start, at most now - 1 s", () => {
    const now = at("2026-10-31T17:00:30Z"); // 1 Nov 00:00:30 Bangkok
    const monthStart = at("2026-10-31T17:00:00Z");
    const notBefore = now - 2 * DAY; // the open activity started 2 days ago (last month)
    inWindow(now, notBefore);
    const { created, reviewed } = currentMonthSlot(now, notBefore, 0.5);
    expect(created - monthStart).toBeGreaterThan(0);
    expect(created - monthStart).toBeLessThan(30_000);
    expect(reviewed).toBeGreaterThan(created);
  });

  it("mid-month: spread from the later of month start / activity start up to 1 h ago", () => {
    const now = at("2026-10-22T05:00:00Z");
    const notBefore = now - 2 * DAY;
    inWindow(now, notBefore);
    const first = currentMonthSlot(now, notBefore, 0);
    const last = currentMonthSlot(now, notBefore, 1);
    expect(first.created).toBeGreaterThanOrEqual(notBefore);
    expect(last.created).toBeLessThanOrEqual(now - 60 * 60_000);
    expect(last.reviewed - last.created).toBeGreaterThanOrEqual(60_000);
  });

  it("an activity that started earlier this month: the month start bounds nothing, the activity does", () => {
    const now = at("2026-10-03T05:00:00Z");
    inWindow(now, now - 2 * DAY);
    expect(currentMonthSlot(now, now - 2 * DAY, 0).created).toBeGreaterThanOrEqual(now - 2 * DAY);
  });

  it("the first second of the month still stays inside it", () => {
    const now = at("2026-10-31T17:00:00.500Z");
    const { created, reviewed } = currentMonthSlot(now, now - DAY, 0.5);
    expect(created).toBeGreaterThanOrEqual(at("2026-10-31T17:00:00Z"));
    expect(reviewed).toBeLessThanOrEqual(now);
  });
});
