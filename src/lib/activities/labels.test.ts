import { describe, expect, it } from "vitest";
import { statusLabelTh, submissionStatusLabelTh, typeLabelTh } from "./labels";

describe("labels", () => {
  it("labels the three types and statuses in Thai", () => {
    for (const t of ["waste", "trees", "fixed"]) expect(typeLabelTh(t)).toMatch(/[฀-๿]/);
    for (const s of ["draft", "open", "closed"]) expect(statusLabelTh(s)).toMatch(/[฀-๿]/);
  });
  it("returns the raw value for unknown input", () => {
    expect(typeLabelTh("x")).toBe("x");
    expect(statusLabelTh("y")).toBe("y");
  });
});

describe("submissionStatusLabelTh", () => {
  it("labels submission statuses as on /my-submissions", () => {
    expect(submissionStatusLabelTh("pending")).toBe("รอตรวจ");
    expect(submissionStatusLabelTh("approved")).toBe("อนุมัติแล้ว");
    expect(submissionStatusLabelTh("rejected")).toBe("ไม่ผ่าน");
    expect(submissionStatusLabelTh("z")).toBe("z");
  });
});
