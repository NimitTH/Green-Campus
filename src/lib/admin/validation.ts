// Pure helpers for the admin pages (/staff/users, /staff/rates; Task 18 Part A, R119-R120).
// Form values are strings. The database checks the same rules again (0019 set_user_role / adjust_ledger,
// waste_categories checks), so these only give early, field-level Thai messages.

import type { Role } from "@/lib/auth/routes";

export const ROLE_LABEL_TH: Record<Role, string> = {
  student: "นักเรียน",
  teacher: "ครู",
  admin: "ผู้ดูแลระบบ",
};

export const LEDGER_KIND_LABEL_TH: Record<string, string> = {
  earn: "ได้รับจากกิจกรรม",
  redeem: "แลกของรางวัล",
  refund: "คืนแต้ม",
  adjust: "ปรับโดยผู้ดูแล",
};

export const USERS_PAGE_SIZE = 20;
export const ADJUST_LIMITS = { pointsMax: 1_000_000, carbonMax: 1_000_000, noteMax: 500 } as const;
export const RATE_LIMITS = { nameMax: 100, pointsMax: 1_000_000, carbonMax: 1_000, sourceNoteMax: 1_000 } as const;

export type RoleFilter = Role | "all";

export function toRoleFilter(value: unknown): RoleFilter {
  return value === "student" || value === "teacher" || value === "admin" ? value : "all";
}

/** ?page= as a 1-based page number (anything odd -> 1). */
export function toPage(value: unknown): number {
  if (typeof value !== "string" || !/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

/** A search term safe inside a PostgREST or() filter and a LIKE pattern (special characters become spaces). */
export function cleanSearchTerm(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[%_*,()\\"'.:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// adjust_ledger form ----------------------------------------------------------------------------

export type AdjustInput = { points: string; carbonKg: string; note: string };
export type AdjustFieldErrors = Partial<Record<keyof AdjustInput, string>>;
export type AdjustValue = { points: number; carbonKg: number; note: string };

const SIGNED_INT_RE = /^[+-]?\d{1,7}$/;
const SIGNED_KG_RE = /^[+-]?\d{1,7}(?:\.\d{1,3})?$/;

export function validateAdjust(input: AdjustInput): { ok: true; value: AdjustValue } | { ok: false; fieldErrors: AdjustFieldErrors } {
  const errors: AdjustFieldErrors = {};
  const pointsText = input.points.trim();
  const carbonText = input.carbonKg.trim();
  let points = 0;
  let carbonKg = 0;

  if (pointsText !== "") {
    if (!SIGNED_INT_RE.test(pointsText) || Math.abs(Number(pointsText)) > ADJUST_LIMITS.pointsMax) {
      errors.points = `กรอกแต้มเป็นจำนวนเต็ม (ติดลบได้) ไม่เกิน ${ADJUST_LIMITS.pointsMax.toLocaleString("th-TH")}`;
    } else points = Number(pointsText);
  }
  if (carbonText !== "") {
    if (!SIGNED_KG_RE.test(carbonText) || Math.abs(Number(carbonText)) > ADJUST_LIMITS.carbonMax) {
      errors.carbonKg = "กรอก carbon เป็นตัวเลข ทศนิยมไม่เกิน 3 ตำแหน่ง (ติดลบได้)";
    } else carbonKg = Number(carbonText);
  }
  if (!errors.points && !errors.carbonKg && points === 0 && carbonKg === 0) {
    errors.points = "กรอกแต้มหรือ carbon ที่จะปรับอย่างน้อยหนึ่งช่อง (ต้องไม่เป็น 0)";
  }

  const note = input.note.trim();
  if (!note) errors.note = "ต้องระบุเหตุผลในการปรับแต้ม";
  else if (note.length > ADJUST_LIMITS.noteMax) errors.note = `เหตุผลยาวได้ไม่เกิน ${ADJUST_LIMITS.noteMax} ตัวอักษร`;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  // -0 from "-0" would print oddly; normalise
  return { ok: true, value: { points: points || 0, carbonKg: carbonKg || 0, note } };
}

// waste_categories form -------------------------------------------------------------------------

export type RateInput = { name: string; pointsPerKg: string; carbonKgPerKg: string; sourceNote: string };
export type RateFieldErrors = Partial<Record<keyof RateInput, string>>;
export type RateRecord = { name: string; points_per_kg: number; carbon_kg_per_kg: number; source_note: string };

const INT_RE = /^\d{1,7}$/;
const KG_RE = /^\d{1,4}(?:\.\d{1,3})?$/;

export function validateRate(input: RateInput): { ok: true; value: RateRecord } | { ok: false; fieldErrors: RateFieldErrors } {
  const errors: RateFieldErrors = {};

  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) errors.name = "กรอกชื่อกลุ่มขยะ";
  else if (name.length > RATE_LIMITS.nameMax) errors.name = `ชื่อยาวได้ไม่เกิน ${RATE_LIMITS.nameMax} ตัวอักษร`;

  const pointsText = input.pointsPerKg.trim();
  if (!INT_RE.test(pointsText) || Number(pointsText) > RATE_LIMITS.pointsMax) {
    errors.pointsPerKg = `กรอกแต้มต่อกิโลกรัมเป็นจำนวนเต็ม 0 ถึง ${RATE_LIMITS.pointsMax.toLocaleString("th-TH")}`;
  }
  const carbonText = input.carbonKgPerKg.trim();
  if (!KG_RE.test(carbonText) || Number(carbonText) > RATE_LIMITS.carbonMax) {
    errors.carbonKgPerKg = `กรอก carbon ต่อกิโลกรัมเป็นตัวเลข 0 ถึง ${RATE_LIMITS.carbonMax.toLocaleString("th-TH")} ทศนิยมไม่เกิน 3 ตำแหน่ง`;
  }

  const sourceNote = input.sourceNote.trim();
  if (!sourceNote) errors.sourceNote = "กรอกที่มาของค่า carbon (เช่น เอกสาร อบก. หรือ ค่าประมาณ: ...)";
  else if (sourceNote.length > RATE_LIMITS.sourceNoteMax) errors.sourceNote = `ที่มาของค่ายาวได้ไม่เกิน ${RATE_LIMITS.sourceNoteMax} ตัวอักษร`;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: { name, points_per_kg: Number(pointsText), carbon_kg_per_kg: Number(carbonText), source_note: sourceNote },
  };
}

/** Plain-object check for Server Action input (reachable by direct POST with any payload). */
export function hasStringFields<K extends string>(value: unknown, keys: readonly K[]): value is Record<K, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const v = value as Record<string, unknown>;
  return keys.every((k) => typeof v[k] === "string");
}

/** "+5" / "-2" / "0" for points. */
export function signed(n: number, format: (x: number) => string = (x) => x.toLocaleString("th-TH")): string {
  return n > 0 ? `+${format(n)}` : format(n);
}
