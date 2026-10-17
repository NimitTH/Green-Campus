import { describe, expect, it } from "vitest";
import { isEnded, joinState } from "./status";

const now = Date.parse("2026-10-17T05:00:00Z");
const future = "2026-10-18T05:00:00Z";
const past = "2026-10-17T04:59:59Z";

describe("joinState", () => {
  it("open and not ended -> can_join", () => {
    expect(joinState({ status: "open", endsAt: future, joined: false, now })).toBe("can_join");
  });
  it("joined wins over every other state", () => {
    expect(joinState({ status: "closed", endsAt: past, joined: true, now })).toBe("joined");
    expect(joinState({ status: "open", endsAt: future, joined: true, now })).toBe("joined");
  });
  it("closed -> closed", () => {
    expect(joinState({ status: "closed", endsAt: future, joined: false, now })).toBe("closed");
  });
  it("draft -> not_open", () => {
    expect(joinState({ status: "draft", endsAt: future, joined: false, now })).toBe("not_open");
  });
  it("open but past ends_at -> ended (ends_at itself counts as ended, like join_activity)", () => {
    expect(joinState({ status: "open", endsAt: past, joined: false, now })).toBe("ended");
    expect(joinState({ status: "open", endsAt: "2026-10-17T05:00:00Z", joined: false, now })).toBe("ended");
  });
});

describe("isEnded", () => {
  it("is true at and after ends_at", () => {
    expect(isEnded("2026-10-17T05:00:00Z", now)).toBe(true);
    expect(isEnded(past, now)).toBe(true);
    expect(isEnded(future, now)).toBe(false);
  });
});
