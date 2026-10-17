// Error codes raised by database functions (message = the code) mapped to Thai text
// that tells the user what to do next (spec 9). Shared by join (Task 6) and submit (Task 8).

export const GENERIC_ERROR_TH = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

const MESSAGES: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน แล้วลองอีกครั้ง",
  not_student: "เฉพาะบัญชีนักเรียนเท่านั้นที่เข้าร่วมกิจกรรมได้",
  activity_not_open: "กิจกรรมนี้ยังไม่เปิดรับหรือปิดรับแล้ว เลือกกิจกรรมอื่นที่เปิดอยู่",
  activity_ended: "กิจกรรมนี้สิ้นสุดแล้ว เข้าร่วมไม่ได้",
  already_joined: "คุณเข้าร่วมกิจกรรมนี้แล้ว",
  activity_has_submissions: "ลบกิจกรรมที่มีผลส่งแล้วไม่ได้ ให้เปลี่ยนสถานะเป็นปิดแทน",
};

function isKnownCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

export function errorMessageTh(code: string | null | undefined): string {
  if (!code || !isKnownCode(code)) return GENERIC_ERROR_TH;
  return MESSAGES[code];
}

/** The code from a Supabase/Postgres error whose message is exactly a known code, else null. */
export function errorCodeFromDb(error: { message?: string | null } | null | undefined): string | null {
  const code = error?.message?.trim();
  return code && isKnownCode(code) ? code : null;
}
