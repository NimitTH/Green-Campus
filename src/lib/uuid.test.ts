import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts canonical uuids in any case", () => {
    expect(isUuid("00000000-0000-0000-0000-000000001501")).toBe(true);
    expect(isUuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(true);
  });
  it.each(["", "abc", "00000000-0000-0000-0000-00000000150", "00000000-0000-0000-0000-0000000015011", " 00000000-0000-0000-0000-000000001501", null, 5])(
    "rejects %j",
    (value) => expect(isUuid(value)).toBe(false),
  );
});
