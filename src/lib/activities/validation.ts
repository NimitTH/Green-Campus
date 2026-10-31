import { bangkokLocalToUtcIso, utcToBangkokLocal } from "../datetime";

// Pure validation for the staff activity form (spec 5 activities, 6.1 units).
// Form values are strings; times are Asia/Bangkok wall time ("YYYY-MM-DDTHH:mm").

export const ACTIVITY_TYPES = ["waste", "trees", "fixed"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_STATUSES = ["draft", "open", "closed"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const LIMITS = {
  titleMax: 120,
  descriptionMax: 2000,
  locationMax: 200,
  unitPointsMax: 100_000,
  unitCarbonKgMax: 10_000,
  wasteMaxKg: 1000,
  treesMax: 10_000,
  detailsMax: 20_000,
} as const;

export type ActivityInput = {
  title: string;
  description: string;
  location: string;
  isOffsite: boolean;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  /** null/undefined -> default by type (waste = true, others = false). */
  requiresCode?: boolean | null;
  unitPoints: string;
  unitCarbonKg: string;
  /** waste: kg per submission; trees: trees per submission; fixed: ignored. */
  maxPerSubmission: string;
  /** Long-form details (DESIGN-3 6.1): plain text, a blank line starts a new paragraph. */
  details: string;
};

/** Columns written to public.activities. */
export type ActivityRecord = {
  title: string;
  description: string | null;
  location: string | null;
  is_offsite: boolean;
  starts_at: string;
  ends_at: string;
  status: ActivityStatus;
  type: ActivityType;
  requires_code: boolean;
  unit_points: number;
  unit_carbon_kg: number | null;
  max_per_submission: number | null;
  details: string | null;
};

export type ActivityFieldErrors = Partial<Record<keyof ActivityInput, string>>;

export type ActivityValidation =
  | { ok: true; value: ActivityRecord }
  | { ok: false; fieldErrors: ActivityFieldErrors };

export function isActivityType(value: string): value is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value);
}

function isActivityStatus(value: string): value is ActivityStatus {
  return (ACTIVITY_STATUSES as readonly string[]).includes(value);
}

export function defaultRequiresCode(type: string): boolean {
  return type === "waste";
}

const STRING_FIELDS = [
  "title",
  "description",
  "location",
  "startsAt",
  "endsAt",
  "status",
  "type",
  "unitPoints",
  "unitCarbonKg",
  "maxPerSubmission",
  "details",
] as const;

/**
 * Runtime shape check for saveActivity input (Server Actions can be POSTed directly with
 * any payload): a plain object, string fields are strings, isOffsite is a boolean,
 * requiresCode is boolean/null/undefined, id is string/undefined, coverPath is string/null/undefined and
 * removeCover is boolean/undefined.
 */
export function isActivityInputShape(
  value: unknown,
): value is ActivityInput & { id?: string; coverPath?: string | null; removeCover?: boolean } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const v = value as Record<string, unknown>;
  if (!STRING_FIELDS.every((key) => typeof v[key] === "string")) return false;
  if (typeof v.isOffsite !== "boolean") return false;
  if (v.requiresCode !== undefined && v.requiresCode !== null && typeof v.requiresCode !== "boolean") return false;
  if (v.id !== undefined && typeof v.id !== "string") return false;
  if (v.coverPath !== undefined && v.coverPath !== null && typeof v.coverPath !== "string") return false;
  if (v.removeCover !== undefined && typeof v.removeCover !== "boolean") return false;
  return true;
}

const DECIMAL_RE = /^\d+(?:\.(\d+))?$/;

type Parsed = { kind: "empty" } | { kind: "bad" } | { kind: "ok"; value: number; decimals: number };

function parseNumber(raw: string): Parsed {
  const s = raw.trim();
  if (s === "") return { kind: "empty" };
  const m = DECIMAL_RE.exec(s);
  if (!m) return { kind: "bad" };
  return { kind: "ok", value: Number(s), decimals: m[1]?.length ?? 0 };
}

function optionalText(raw: string): string | null {
  const s = raw.trim();
  return s === "" ? null : s;
}

export function validateActivity(input: ActivityInput): ActivityValidation {
  const errors: ActivityFieldErrors = {};

  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) errors.title = "กรอกชื่อกิจกรรม";
  else if (title.length > LIMITS.titleMax) errors.title = `ชื่อกิจกรรมยาวได้ไม่เกิน ${LIMITS.titleMax} ตัวอักษร`;

  const description = optionalText(input.description);
  if (description && description.length > LIMITS.descriptionMax) {
    errors.description = `รายละเอียดยาวได้ไม่เกิน ${LIMITS.descriptionMax} ตัวอักษร`;
  }
  const location = optionalText(input.location);
  if (location && location.length > LIMITS.locationMax) {
    errors.location = `สถานที่ยาวได้ไม่เกิน ${LIMITS.locationMax} ตัวอักษร`;
  }

  const details = optionalText(input.details);
  if (details && details.length > LIMITS.detailsMax) {
    errors.details = `รายละเอียดกิจกรรมยาวได้ไม่เกิน ${LIMITS.detailsMax.toLocaleString("th-TH")} ตัวอักษร`;
  }

  const startsAt = bangkokLocalToUtcIso(input.startsAt.trim());
  const endsAt = bangkokLocalToUtcIso(input.endsAt.trim());
  if (!startsAt) errors.startsAt = "เลือกวันและเวลาเริ่มกิจกรรม";
  if (!endsAt) errors.endsAt = "เลือกวันและเวลาสิ้นสุดกิจกรรม";
  else if (startsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.endsAt = "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  }

  const status = input.status.trim();
  if (!isActivityStatus(status)) errors.status = "เลือกสถานะกิจกรรม";
  const type = input.type.trim();
  if (!isActivityType(type)) errors.type = "เลือกชนิดกิจกรรม";

  let unitPoints = 0;
  let unitCarbonKg: number | null = null;
  let maxPerSubmission: number | null = null;

  if (type === "trees" || type === "fixed") {
    const p = parseNumber(input.unitPoints);
    if (p.kind === "empty") errors.unitPoints = "กรอกแต้มที่ได้";
    else if (p.kind === "bad" || p.decimals > 0) errors.unitPoints = "แต้มต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป";
    else if (p.value > LIMITS.unitPointsMax) errors.unitPoints = `แต้มต้องไม่เกิน ${LIMITS.unitPointsMax.toLocaleString("th-TH")}`;
    else unitPoints = p.value;

    const c = parseNumber(input.unitCarbonKg);
    if (c.kind === "bad") errors.unitCarbonKg = "carbon ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป";
    else if (c.kind === "ok") {
      if (c.decimals > 3) errors.unitCarbonKg = "carbon มีทศนิยมได้ไม่เกิน 3 ตำแหน่ง";
      else if (c.value > LIMITS.unitCarbonKgMax) errors.unitCarbonKg = `carbon ต้องไม่เกิน ${LIMITS.unitCarbonKgMax.toLocaleString("th-TH")} กก.`;
      else unitCarbonKg = c.value;
    }
  }

  if (type === "waste") {
    const m = parseNumber(input.maxPerSubmission);
    if (m.kind === "bad") errors.maxPerSubmission = "กรอกน้ำหนักเป็นตัวเลข (กก.)";
    else if (m.kind === "ok") {
      if (m.decimals > 3) errors.maxPerSubmission = "น้ำหนักมีทศนิยมได้ไม่เกิน 3 ตำแหน่ง (1 กรัม)";
      else if (m.value <= 0 || m.value > LIMITS.wasteMaxKg) {
        errors.maxPerSubmission = `น้ำหนักสูงสุดต้องมากกว่า 0 และไม่เกิน ${LIMITS.wasteMaxKg} กก.`;
      } else maxPerSubmission = Math.round(m.value * 1000);
    }
  } else if (type === "trees") {
    const m = parseNumber(input.maxPerSubmission);
    if (m.kind === "bad" || (m.kind === "ok" && (m.decimals > 0 || m.value < 1 || m.value > LIMITS.treesMax))) {
      errors.maxPerSubmission = `จำนวนต้นสูงสุดต้องเป็นจำนวนเต็ม 1 ถึง ${LIMITS.treesMax.toLocaleString("th-TH")}`;
    } else if (m.kind === "ok") maxPerSubmission = m.value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  const requiresCode =
    input.requiresCode === null || input.requiresCode === undefined
      ? defaultRequiresCode(type)
      : input.requiresCode;

  return {
    ok: true,
    value: {
      title,
      description,
      location,
      is_offsite: input.isOffsite,
      starts_at: startsAt!,
      ends_at: endsAt!,
      status: status as ActivityStatus,
      type: type as ActivityType,
      requires_code: requiresCode,
      unit_points: unitPoints,
      unit_carbon_kg: unitCarbonKg,
      max_per_submission: maxPerSubmission,
      details,
    },
  };
}

/** A stored activity row -> form values (edit page). */
export function activityToInput(row: {
  title: string;
  description: string | null;
  location: string | null;
  is_offsite: boolean;
  starts_at: string;
  ends_at: string;
  status: string;
  type: string;
  requires_code: boolean;
  unit_points: number;
  unit_carbon_kg: number | string | null;
  max_per_submission: number | null;
  details: string | null;
}): ActivityInput {
  const max = row.max_per_submission;
  return {
    title: row.title,
    description: row.description ?? "",
    location: row.location ?? "",
    isOffsite: row.is_offsite,
    startsAt: utcToBangkokLocal(row.starts_at),
    endsAt: utcToBangkokLocal(row.ends_at),
    status: row.status,
    type: row.type,
    requiresCode: row.requires_code,
    unitPoints: String(row.unit_points),
    unitCarbonKg: row.unit_carbon_kg === null ? "" : String(Number(row.unit_carbon_kg)),
    maxPerSubmission: max === null ? "" : row.type === "waste" ? String(max / 1000) : String(max),
    details: row.details ?? "",
  };
}

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** The staff form's FormData -> ActivityInput (shared by the server action and the form's cover flow). */
export function activityInputFromForm(formData: FormData): ActivityInput {
  return {
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    location: formText(formData, "location"),
    isOffsite: formData.get("isOffsite") === "on",
    startsAt: formText(formData, "startsAt"),
    endsAt: formText(formData, "endsAt"),
    status: formText(formData, "status"),
    type: formText(formData, "type"),
    requiresCode: formData.get("requiresCode") === "on",
    unitPoints: formText(formData, "unitPoints"),
    unitCarbonKg: formText(formData, "unitCarbonKg"),
    maxPerSubmission: formText(formData, "maxPerSubmission"),
    details: formText(formData, "details"),
  };
}
