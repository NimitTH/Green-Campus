import { beforeEach, describe, expect, it, vi } from "vitest";

// The route's error path (Phase 2 review 4f): a failing render answers 500, private, no-store,
// with a generic message, and logs the error on the server.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn(async () => ({ id: "u1", role: "student" })) }));
vi.mock("@/lib/orders/queries", () => ({
  getOrder: vi.fn(async (id: string) => ({
    id,
    status: "pending_pickup",
    totalPoints: 10,
    createdAt: "2026-10-21T03:15:00Z",
    expiresAt: "2026-10-28T03:15:00Z",
    readyAt: null,
    studentId: "u1",
    studentName: "นักเรียน",
    completedAt: null,
    lines: [{ rewardId: "r1", name: "ถุงผ้า", qty: 1, unitCost: 10 }],
  })),
}));
vi.mock("@/lib/pdf/receipt", () => ({
  renderReceipt: vi.fn(async () => {
    throw new Error("font file missing");
  }),
}));

const ORDER_ID = "a1b2c3d4-1111-4222-8333-444455556666";

describe("GET /api/receipts/[orderId]", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("answers 500 private no-store with a generic message when rendering fails, and logs it", async () => {
    const { GET } = await import("./route");
    const res = await GET({} as never, { params: Promise.resolve({ orderId: ORDER_ID }) } as never);
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.text();
    expect(body).toContain("สร้างใบเสร็จไม่สำเร็จ");
    expect(body).not.toContain("font file missing");
    expect(console.error).toHaveBeenCalled();
  });
});
