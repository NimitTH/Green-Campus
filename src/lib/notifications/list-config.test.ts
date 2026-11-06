import { describe, expect, it } from "vitest";
import { parseListParams } from "@/app/_components/list/list-params";
import { STAFF_NOTIFICATION_CONFIG, STUDENT_NOTIFICATION_CONFIG, typePrefix } from "./list-config";

describe("notification list config", () => {
  it("student type options", () => {
    expect(STUDENT_NOTIFICATION_CONFIG.filters.type.options).toEqual({ activity: "กิจกรรม", submission: "ผลที่ส่ง", order: "ออเดอร์" });
  });
  it("staff has only submission and order", () => {
    expect(Object.keys(STAFF_NOTIFICATION_CONFIG.filters.type.options)).toEqual(["submission", "order"]);
  });
  it("typePrefix maps a type filter to a LIKE pattern", () => {
    expect(typePrefix("order")).toBe("order_%");
    expect(typePrefix("activity")).toBe("activity_%");
    expect(typePrefix("all")).toBeNull();
    expect(typePrefix("xyz")).toBeNull();
  });
  it("falls back to date for an unknown sort", () => {
    const s = parseListParams(STUDENT_NOTIFICATION_CONFIG, { sort: "price" });
    expect(s.sort).toBe("date");
    expect(s.dir).toBe("desc");
  });
  it("junk type falls back to all", () => {
    expect(parseListParams(STAFF_NOTIFICATION_CONFIG, { type: "activity" }).filters.type).toBe("all");
  });
});
