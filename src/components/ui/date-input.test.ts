import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateInput, DateTimeInput } from "./index";
import { calendarGrid, moveDay, parseThaiTime } from "./date-input";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("DateInput", () => {
  it("shows the Thai date and posts the ISO date in a hidden input", () => {
    const out = html(createElement(DateInput, { name: "from", id: "f", defaultValue: "2026-11-06" }));
    expect(out).toContain('value="06/11/2569"');
    expect(out).toContain('type="hidden"');
    expect(out).toContain('name="from"');
    expect(out).toContain('value="2026-11-06"');
    expect(out).toContain('inputMode="numeric"');
    expect(out).toContain('aria-label="เลือกวันที่จากปฏิทิน"');
    expect(out).not.toContain('role="dialog"');
  });
  it("posts an empty hidden value without a default", () => {
    const out = html(createElement(DateInput, { name: "to", id: "t" }));
    expect(out).toMatch(/<input type="hidden" name="to" value=""/);
  });
});

describe("DateTimeInput", () => {
  it("splits the value into a Thai date and a 24h time, and posts the datetime-local value", () => {
    const out = html(createElement(DateTimeInput, { name: "startsAt", id: "s", defaultValue: "2026-11-06T08:05" }));
    expect(out).toContain('value="06/11/2569"');
    expect(out).toContain('value="08:05"');
    expect(out).toContain('name="startsAt"');
    expect(out).toContain('value="2026-11-06T08:05"');
  });
  it("links a server error with aria-describedby", () => {
    const out = html(createElement(DateTimeInput, { name: "startsAt", id: "s", error: "เลือกวันและเวลาเริ่มกิจกรรม" }));
    expect(out).toContain('aria-describedby="s-error"');
    expect(out).toContain('id="s-error"');
  });
});

describe("helpers", () => {
  it("parseThaiTime", () => {
    expect(parseThaiTime("08:05")).toBe("08:05");
    expect(parseThaiTime("8:05")).toBe("08:05");
    expect(parseThaiTime("24:00")).toBeNull();
    expect(parseThaiTime("12:60")).toBeNull();
    expect(parseThaiTime("")).toBeNull();
  });
  it("moveDay clamps month moves to the last day", () => {
    expect(moveDay("2026-11-06", 1)).toBe("2026-11-07");
    expect(moveDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(moveDay("2026-03-31", 0, 1)).toBe("2026-04-30");
    expect(moveDay("2026-01-15", 0, -1)).toBe("2025-12-15");
  });
  it("calendarGrid is Sunday-first with leading and trailing blanks", () => {
    const weeks = calendarGrid(2026, 10); // November 2026 starts on Sunday
    expect(weeks[0][0]).toBe("2026-11-01");
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});
