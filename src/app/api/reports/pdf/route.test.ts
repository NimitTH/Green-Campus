import { beforeEach, describe, expect, it, vi } from "vitest";

// GET /api/reports/pdf (Task 17, R110): the status codes before any data is read, and the error path.

vi.mock("server-only", () => ({}));
const user = vi.hoisted(() => ({ current: null as null | { id: string; role: string } }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn(async () => user.current) }));
const report = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/reports/data", () => ({
  getActivityReport: vi.fn(async () => {
    if (report.fail) throw new Error("db down");
    return [];
  }),
}));

const request = (query: string) => ({ nextUrl: new URL(`http://localhost/api/reports/pdf?${query}`) }) as never;
const OK = "from=2036-05-01&to=2036-05-31";

describe("GET /api/reports/pdf", () => {
  beforeEach(() => {
    user.current = { id: "t1", role: "teacher" };
    report.fail = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("answers 401 anonymous, 403 student and 400 for bad ranges, all private no-store", async () => {
    const { GET } = await import("./route");
    const { getActivityReport } = await import("@/lib/reports/data");
    user.current = null;
    expect((await GET(request(OK))).status).toBe(401);
    user.current = { id: "s1", role: "student" };
    expect((await GET(request(OK))).status).toBe(403);
    user.current = { id: "t1", role: "teacher" };
    for (const q of ["from=2036-02-30&to=2036-03-01", "from=2036-05-02&to=2036-05-01", "from=2036-05-01", "from=2030-01-01&to=2036-01-01"]) {
      const res = await GET(request(q));
      expect(res.status, q).toBe(400);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await res.text()).toMatch(/[ก-๙]/);
    }
    expect(getActivityReport).not.toHaveBeenCalled();
  });

  it("returns the PDF as an attachment for staff, even for an empty range", async () => {
    const { GET } = await import("./route");
    const res = await GET(request(OK));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="report-summary-2036-05-01-2036-05-31.pdf"');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("answers 500 with a generic message when the data or the render fails, and logs it", async () => {
    const { GET } = await import("./route");
    report.fail = true;
    const res = await GET(request(OK));
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.text();
    expect(body).toContain("สร้างรายงานไม่สำเร็จ");
    expect(body).not.toContain("db down");
    expect(console.error).toHaveBeenCalled();
  });
});
