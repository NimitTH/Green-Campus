import { describe, expect, it } from "vitest";
import {
  activityToInput,
  defaultRequiresCode,
  validateActivity,
  type ActivityInput,
} from "./validation";

function input(overrides: Partial<ActivityInput> = {}): ActivityInput {
  return {
    title: "เก็บขยะรอบโรงเรียน",
    description: "",
    location: "ลานหน้าเสาธง",
    isOffsite: false,
    startsAt: "2026-10-20T08:00",
    endsAt: "2026-10-20T12:00",
    status: "open",
    type: "fixed",
    requiresCode: null,
    unitPoints: "20",
    unitCarbonKg: "",
    maxPerSubmission: "",
    ...overrides,
  };
}

function errorsOf(i: ActivityInput) {
  const result = validateActivity(i);
  if (result.ok) throw new Error("expected errors");
  return result.fieldErrors;
}

function valueOf(i: ActivityInput) {
  const result = validateActivity(i);
  if (!result.ok) throw new Error(`unexpected errors: ${JSON.stringify(result.fieldErrors)}`);
  return result.value;
}

describe("defaultRequiresCode", () => {
  it("waste requires a weigh code by default, other types do not", () => {
    expect(defaultRequiresCode("waste")).toBe(true);
    expect(defaultRequiresCode("trees")).toBe(false);
    expect(defaultRequiresCode("fixed")).toBe(false);
  });
});

describe("validateActivity: common fields", () => {
  it("accepts a valid fixed activity and converts times to UTC", () => {
    const v = valueOf(input());
    expect(v).toMatchObject({
      title: "เก็บขยะรอบโรงเรียน",
      description: null,
      location: "ลานหน้าเสาธง",
      is_offsite: false,
      starts_at: "2026-10-20T01:00:00.000Z",
      ends_at: "2026-10-20T05:00:00.000Z",
      status: "open",
      type: "fixed",
      requires_code: false,
      unit_points: 20,
      unit_carbon_kg: null,
      max_per_submission: null,
    });
  });

  it("requires a title (whitespace only does not count) and trims it", () => {
    expect(errorsOf(input({ title: "   " })).title).toBeTruthy();
    expect(valueOf(input({ title: "  ปลูกป่า  " })).title).toBe("ปลูกป่า");
  });

  it("limits title length", () => {
    expect(errorsOf(input({ title: "ก".repeat(121) })).title).toBeTruthy();
  });

  it("requires valid start and end times", () => {
    const e = errorsOf(input({ startsAt: "", endsAt: "bad" }));
    expect(e.startsAt).toBeTruthy();
    expect(e.endsAt).toBeTruthy();
  });

  it("requires ends_at after starts_at", () => {
    expect(errorsOf(input({ endsAt: "2026-10-20T08:00" })).endsAt).toBeTruthy();
    expect(errorsOf(input({ endsAt: "2026-10-19T08:00" })).endsAt).toBeTruthy();
  });

  it("rejects unknown status and type", () => {
    expect(errorsOf(input({ status: "archived" })).status).toBeTruthy();
    expect(errorsOf(input({ type: "money" })).type).toBeTruthy();
  });

  it("keeps is_offsite", () => {
    expect(valueOf(input({ isOffsite: true })).is_offsite).toBe(true);
  });
});

describe("validateActivity: requires_code", () => {
  it("defaults by type when not given", () => {
    expect(valueOf(input({ type: "waste", requiresCode: undefined })).requires_code).toBe(true);
    expect(valueOf(input({ type: "trees", requiresCode: null })).requires_code).toBe(false);
  });
  it("teacher can override the default", () => {
    expect(valueOf(input({ type: "waste", requiresCode: false })).requires_code).toBe(false);
    expect(valueOf(input({ type: "fixed", requiresCode: true })).requires_code).toBe(true);
  });
});

describe("validateActivity: unit fields per type", () => {
  it("waste ignores unit points/carbon (rates come from waste categories)", () => {
    const v = valueOf(input({ type: "waste", unitPoints: "99", unitCarbonKg: "5" }));
    expect(v.unit_points).toBe(0);
    expect(v.unit_carbon_kg).toBeNull();
  });

  it("waste max_per_submission is entered in kg and stored in grams", () => {
    expect(valueOf(input({ type: "waste", maxPerSubmission: "2.5" })).max_per_submission).toBe(2500);
    expect(valueOf(input({ type: "waste", maxPerSubmission: "" })).max_per_submission).toBeNull();
  });

  it("waste max_per_submission must be > 0, at most 1000 kg, at most 3 decimals", () => {
    expect(errorsOf(input({ type: "waste", maxPerSubmission: "0" })).maxPerSubmission).toBeTruthy();
    expect(errorsOf(input({ type: "waste", maxPerSubmission: "1000.5" })).maxPerSubmission).toBeTruthy();
    expect(errorsOf(input({ type: "waste", maxPerSubmission: "1.2345" })).maxPerSubmission).toBeTruthy();
    expect(errorsOf(input({ type: "waste", maxPerSubmission: "-1" })).maxPerSubmission).toBeTruthy();
  });

  it("trees requires integer unit points and allows optional carbon and max trees", () => {
    const v = valueOf(input({ type: "trees", unitPoints: "15", unitCarbonKg: "9.5", maxPerSubmission: "10" }));
    expect(v).toMatchObject({ unit_points: 15, unit_carbon_kg: 9.5, max_per_submission: 10 });
    expect(errorsOf(input({ type: "trees", unitPoints: "" })).unitPoints).toBeTruthy();
    expect(errorsOf(input({ type: "trees", unitPoints: "1.5" })).unitPoints).toBeTruthy();
    expect(errorsOf(input({ type: "trees", maxPerSubmission: "2.5" })).maxPerSubmission).toBeTruthy();
    expect(errorsOf(input({ type: "trees", maxPerSubmission: "0" })).maxPerSubmission).toBeTruthy();
  });

  it("fixed requires unit points, ignores max_per_submission (always 1 per submission)", () => {
    expect(errorsOf(input({ type: "fixed", unitPoints: "abc" })).unitPoints).toBeTruthy();
    expect(valueOf(input({ type: "fixed", maxPerSubmission: "7" })).max_per_submission).toBeNull();
    expect(valueOf(input({ type: "fixed", unitPoints: "0" })).unit_points).toBe(0);
  });

  it("enforces numeric limits on points and carbon", () => {
    expect(errorsOf(input({ unitPoints: "100001" })).unitPoints).toBeTruthy();
    expect(errorsOf(input({ unitPoints: "-5" })).unitPoints).toBeTruthy();
    expect(errorsOf(input({ unitCarbonKg: "-0.1" })).unitCarbonKg).toBeTruthy();
    expect(errorsOf(input({ unitCarbonKg: "10001" })).unitCarbonKg).toBeTruthy();
    expect(errorsOf(input({ unitCarbonKg: "0.0001" })).unitCarbonKg).toBeTruthy();
    expect(valueOf(input({ unitCarbonKg: "0.125" })).unit_carbon_kg).toBe(0.125);
  });
});

describe("activityToInput", () => {
  it("turns a stored row back into form values (Bangkok time, kg for waste)", () => {
    const i = activityToInput({
      title: "ชั่งขยะ",
      description: null,
      location: null,
      is_offsite: true,
      starts_at: "2026-10-20T01:00:00+00:00",
      ends_at: "2026-10-20T05:00:00+00:00",
      status: "draft",
      type: "waste",
      requires_code: true,
      unit_points: 0,
      unit_carbon_kg: null,
      max_per_submission: 2500,
    });
    expect(i).toEqual({
      title: "ชั่งขยะ",
      description: "",
      location: "",
      isOffsite: true,
      startsAt: "2026-10-20T08:00",
      endsAt: "2026-10-20T12:00",
      status: "draft",
      type: "waste",
      requiresCode: true,
      unitPoints: "0",
      unitCarbonKg: "",
      maxPerSubmission: "2.5",
    });
    expect(validateActivity(i).ok).toBe(true);
  });
});
