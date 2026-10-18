/** Same rule as reject_submission (R34): trimmed, not blank, at most 500 characters. */
export const REJECT_REASON_MAX = 500;

/** The error code for a reject reason, or null when it is fine. */
export function rejectReasonError(reason: string): "reason_required" | "reason_too_long" | null {
  const trimmed = reason.trim();
  if (trimmed === "") return "reason_required";
  // Code points, like char_length in the database.
  if ([...trimmed].length > REJECT_REASON_MAX) return "reason_too_long";
  return null;
}
