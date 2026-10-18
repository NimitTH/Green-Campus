import { describe, expect, it } from "vitest";
import { REJECT_REASON_MAX, rejectReasonError } from "./reason";

describe("rejectReasonError", () => {
  it("requires a non-blank reason", () => {
    expect(rejectReasonError("")).toBe("reason_required");
    expect(rejectReasonError("   \n ")).toBe("reason_required");
  });
  it("accepts up to 500 characters after trimming", () => {
    expect(rejectReasonError("  รูปไม่ชัด  ")).toBeNull();
    expect(rejectReasonError(` ${"ก".repeat(REJECT_REASON_MAX)} `)).toBeNull();
  });
  it("refuses more than 500 characters (code points, like char_length)", () => {
    expect(rejectReasonError("ก".repeat(REJECT_REASON_MAX + 1))).toBe("reason_too_long");
    // 500 emoji are 1000 UTF-16 units but 500 code points
    expect(rejectReasonError("😀".repeat(REJECT_REASON_MAX))).toBeNull();
  });
});
