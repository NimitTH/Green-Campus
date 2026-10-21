// Name rules shared by sign-up (validateSignUp) and /profile (Task 18 Part B, R123, R126.2).
// The database enforces the same limits (profiles checks, 0019/0021); these give early Thai messages.
// Lengths are counted in code points, like Postgres char_length.

export const NAME_LIMITS = { fullNameMax: 100, displayNameMax: 50 } as const;

const FULL_NAME_REQUIRED = "กรอกชื่อ-นามสกุลจริง";
const FULL_NAME_TOO_LONG = `ชื่อ-นามสกุลยาวได้ไม่เกิน ${NAME_LIMITS.fullNameMax} ตัวอักษร`;
const DISPLAY_NAME_TOO_LONG = `ชื่อที่แสดงยาวได้ไม่เกิน ${NAME_LIMITS.displayNameMax} ตัวอักษร`;

/** Trim and collapse every run of whitespace (tabs, newlines) to one space. */
export function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function length(value: string): number {
  return Array.from(value).length;
}

/** Error for an already-normalised full name, or undefined. */
export function validateFullName(fullName: string): string | undefined {
  if (!fullName) return FULL_NAME_REQUIRED;
  if (length(fullName) > NAME_LIMITS.fullNameMax) return FULL_NAME_TOO_LONG;
  return undefined;
}

export type ProfileInput = { fullName: string; displayName: string };
export type ProfileFieldErrors = Partial<Record<keyof ProfileInput, string>>;
export type ProfileRecord = { full_name: string; display_name: string | null };

export function isProfileInputShape(value: unknown): value is ProfileInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.fullName === "string" && typeof v.displayName === "string";
}

export function validateProfile(
  input: ProfileInput,
): { ok: true; value: ProfileRecord } | { ok: false; fieldErrors: ProfileFieldErrors } {
  const fullName = normalizeName(input.fullName);
  const displayName = normalizeName(input.displayName);
  const errors: ProfileFieldErrors = {};
  const fullNameError = validateFullName(fullName);
  if (fullNameError) errors.fullName = fullNameError;
  if (length(displayName) > NAME_LIMITS.displayNameMax) errors.displayName = DISPLAY_NAME_TOO_LONG;
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { full_name: fullName, display_name: displayName || null } };
}

/**
 * The name shown on the leaderboard: display_name, else full_name, else 'ไม่ระบุชื่อ', each trimmed of
 * all whitespace (the profile_display_name rule, 0021).
 */
export function previewDisplayName(displayName: string | null | undefined, fullName: string | null | undefined): string {
  return displayName?.trim() || fullName?.trim() || "ไม่ระบุชื่อ";
}
