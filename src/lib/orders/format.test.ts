import { describe, expect, it } from "vitest";
import { blockedReasonTh, isOrderOverdue, studentDisplayName, isOrderReady, orderIdRange, orderNumber, orderStatusLabelTh, orderStatusTone, parseBlocked } from "./format";

describe("orderStatusLabelTh", () => {
  const READY = "2026-10-21T03:00:00+00:00";
  it.each([
    ["pending_pickup", null, "รอเตรียมของ"],
    ["pending_pickup", undefined, "รอเตรียมของ"],
    ["pending_pickup", READY, "พร้อมรับ"],
    ["completed", null, "รับแล้ว"],
    ["completed", READY, "รับแล้ว"],
    ["cancelled", null, "ยกเลิก"],
    ["cancelled", READY, "ยกเลิก"],
    ["expired", null, "หมดอายุ"],
    ["expired", READY, "หมดอายุ"],
  ])("%s, ready_at %s -> %s", (status, readyAt, label) => {
    expect(orderStatusLabelTh(status, readyAt)).toBe(label);
  });
  it("passes unknown values through", () => {
    expect(orderStatusLabelTh("toString")).toBe("toString");
  });
  it("tones", () => {
    expect(orderStatusTone("pending_pickup")).toBe("amber");
    expect(orderStatusTone("pending_pickup", READY)).toBe("green");
    expect(orderStatusTone("completed")).toBe("green");
    expect(orderStatusTone("expired")).toBe("gray");
  });
});

describe("isOrderReady", () => {
  it("is true only for a pending order with ready_at", () => {
    expect(isOrderReady("pending_pickup", "2026-10-21T03:00:00Z")).toBe(true);
    expect(isOrderReady("pending_pickup", null)).toBe(false);
    expect(isOrderReady("completed", "2026-10-21T03:00:00Z")).toBe(false);
  });
});

describe("orderNumber", () => {
  it("is the first 8 characters, uppercased", () => {
    expect(orderNumber("a1b2c3d4-0000-4000-8000-000000000000")).toBe("A1B2C3D4");
  });
});

describe("blockedReasonTh", () => {
  it("stock", () => {
    expect(blockedReasonTh({ reward_id: "x", reason: "stock", available: 2 }, "สมุด")).toBe("สมุด: สต็อกเหลือ 2 ชิ้น ลดจำนวนลงก่อน");
  });
  it("inactive", () => {
    expect(blockedReasonTh({ reward_id: "x", reason: "inactive" }, undefined)).toContain("ปิดการแลกแล้ว");
  });
  it("points", () => {
    expect(blockedReasonTh({ reward_id: null, reason: "points", shortfall: 1200 }, undefined)).toBe("แต้มไม่พอ ขาดอีก 1,200 แต้ม");
  });
});

describe("parseBlocked", () => {
  it("keeps valid items and drops the rest", () => {
    expect(
      parseBlocked([
        { reward_id: "a", reason: "stock", available: 0 },
        { reward_id: "b", reason: "inactive" },
        { reward_id: null, reason: "points", shortfall: 5 },
        { reward_id: "c", reason: "stock" },
        null,
        "x",
      ]),
    ).toEqual([
      { reward_id: "a", reason: "stock", available: 0 },
      { reward_id: "b", reason: "inactive" },
      { reward_id: null, reason: "points", shortfall: 5 },
    ]);
    expect(parseBlocked(null)).toEqual([]);
  });
});

describe("orderIdRange", () => {
  it("pads a short prefix into a uuid range", () => {
    expect(orderIdRange("A1B2c3")).toEqual({
      from: "a1b2c300-0000-0000-0000-000000000000",
      to: "a1b2c3ff-ffff-ffff-ffff-ffffffffffff",
    });
  });
  it("accepts a full uuid", () => {
    const id = "a1b2c3d4-1111-4222-8333-444455556666";
    expect(orderIdRange(id)).toEqual({ from: id, to: id });
  });
  it.each(["", "  ", "สมชาย", "xyz", "a".repeat(33)])("rejects %j", (q) => {
    expect(orderIdRange(q)).toBeNull();
  });
});

describe("isOrderOverdue", () => {
  const now = Date.parse("2026-10-20T10:00:00Z");
  it("is true for a pending order at or past expires_at", () => {
    expect(isOrderOverdue("pending_pickup", "2026-10-20T10:00:00+00:00", now)).toBe(true);
    expect(isOrderOverdue("pending_pickup", "2026-10-20T10:00:01+00:00", now)).toBe(false);
  });
  it("is false for other statuses", () => {
    expect(isOrderOverdue("completed", "2026-10-01T00:00:00Z", now)).toBe(false);
  });
});

describe("isOrderOverdue (ready orders and the receipt)", () => {
  const now = Date.parse("2026-10-20T10:00:00Z");
  it("counts a ready order past its deadline as overdue too (status stays pending_pickup)", () => {
    expect(isOrderOverdue("pending_pickup", "2026-10-19T10:00:00Z", now)).toBe(true);
  });
  it("is false for an expired order (already released)", () => {
    expect(isOrderOverdue("expired", "2026-10-19T10:00:00Z", now)).toBe(false);
  });
});

describe("studentDisplayName", () => {
  it.each([
    ["น้องหนึ่ง", "นักเรียน หนึ่ง", "น้องหนึ่ง"],
    ["  น้องหนึ่ง  ", "นักเรียน หนึ่ง", "น้องหนึ่ง"],
    ["   ", "นักเรียน หนึ่ง", "นักเรียน หนึ่ง"],
    ["", "นักเรียน หนึ่ง", "นักเรียน หนึ่ง"],
    [null, "นักเรียน หนึ่ง", "นักเรียน หนึ่ง"],
    [" ", "  นักเรียน หนึ่ง ", "นักเรียน หนึ่ง"],
    ["", " ", "ไม่ระบุชื่อ"],
    [null, "", "ไม่ระบุชื่อ"],
  ])("display %j, full %j -> %j", (display, full, expected) => {
    expect(studentDisplayName(display, full)).toBe(expected);
  });
});
