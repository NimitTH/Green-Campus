import { describe, expect, it } from "vitest";
import { activityProgress } from "./activity-progress";

const at = (iso: string) => new Date(iso);

describe("activityProgress", () => {
  it("not started yet: 0% and whole Bangkok days to the end", () => {
    expect(activityProgress("2026-11-01T08:00+07:00", "2026-11-10T17:00+07:00", at("2026-10-30T12:00+07:00"))).toEqual({
      percent: 0,
      daysLeft: 11,
    });
  });

  it("half way through", () => {
    expect(activityProgress("2026-11-01T00:00+07:00", "2026-11-11T00:00+07:00", at("2026-11-06T00:00+07:00"))).toEqual({
      percent: 50,
      daysLeft: 5,
    });
  });

  it("ends later today in Bangkok (UTC date differs): 0 days left", () => {
    // 23:30 Bangkok = 16:30 UTC the same day; 08:00 Bangkok = 01:00 UTC
    const r = activityProgress("2026-11-01T08:00+07:00", "2026-11-10T23:30+07:00", at("2026-11-10T08:00+07:00"));
    expect(r.daysLeft).toBe(0);
  });

  it("ends just after Bangkok midnight (UTC still the previous day): 1 day left", () => {
    // 00:30 on the 11th Bangkok = 17:30 UTC on the 10th
    const r = activityProgress("2026-11-01T08:00+07:00", "2026-11-11T00:30+07:00", at("2026-11-10T23:50+07:00"));
    expect(r.daysLeft).toBe(1);
  });

  it("already ended: 100% and 0 days, never negative", () => {
    expect(activityProgress("2026-11-01T08:00+07:00", "2026-11-10T17:00+07:00", at("2026-11-20T09:00+07:00"))).toEqual({
      percent: 100,
      daysLeft: 0,
    });
  });

  it("starts == ends: no division by zero", () => {
    const t = "2026-11-10T17:00+07:00";
    expect(activityProgress(t, t, at("2026-11-10T17:00+07:00")).percent).toBe(100);
    expect(activityProgress(t, t, at("2026-11-10T18:00+07:00")).percent).toBe(100);
    expect(activityProgress(t, t, at("2026-11-10T16:00+07:00")).percent).toBe(0);
  });

  it("rounds to a whole percent", () => {
    // 1 of 3 hours elapsed -> 33.33...%
    expect(activityProgress("2026-11-10T09:00+07:00", "2026-11-10T12:00+07:00", at("2026-11-10T10:00+07:00")).percent).toBe(33);
  });
});
