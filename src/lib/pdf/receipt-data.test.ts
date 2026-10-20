import { describe, expect, it } from "vitest";
import type { OrderDetail } from "@/lib/orders/queries";
import { toReceiptData } from "./receipt-data";

const base: OrderDetail = {
  id: "a1b2c3d4-1111-4222-8333-444455556666",
  status: "pending_pickup",
  totalPoints: 70,
  createdAt: "2026-10-21T03:15:00+00:00",
  expiresAt: "2026-10-28T10:00:00+00:00",
  readyAt: null,
  studentId: "s1",
  studentName: "สมชาย ใจดี",
  completedAt: null,
  lines: [
    { rewardId: "r1", name: "กระบอกน้ำ", qty: 2, unitCost: 20 },
    { rewardId: "r2", name: "ถุงผ้า", qty: 1, unitCost: 30 },
  ],
};

describe("toReceiptData", () => {
  it("maps an order to the receipt fields", () => {
    expect(toReceiptData(base)).toEqual({
      orderNo: "A1B2C3D4",
      createdAt: new Date("2026-10-21T03:15:00Z"),
      studentName: "สมชาย ใจดี",
      status: "รอเตรียมของ",
      expiresAt: new Date("2026-10-28T10:00:00Z"),
      items: [
        { name: "กระบอกน้ำ", qty: 2, unitCost: 20 },
        { name: "ถุงผ้า", qty: 1, unitCost: 30 },
      ],
      totalPoints: 70,
    });
  });

  it.each([
    ["pending_pickup", "2026-10-21T04:00:00Z", "พร้อมรับ"],
    ["completed", null, "รับแล้ว"],
    ["cancelled", null, "ยกเลิก"],
    ["expired", null, "หมดอายุ"],
  ])("status %s (ready_at %s) -> %s", (status, readyAt, label) => {
    expect(toReceiptData({ ...base, status, readyAt }).status).toBe(label);
  });

  it("uses a dash when the student has no profile name", () => {
    expect(toReceiptData({ ...base, studentName: null }).studentName).toBe("-");
  });
});
