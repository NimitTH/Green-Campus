// Error codes raised by database functions (message = the code) mapped to Thai text
// that tells the user what to do next (spec 9). Shared by join (Task 6) and submit (Task 8).

export const GENERIC_ERROR_TH = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

const MESSAGES: Record<string, string> = {
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน แล้วลองอีกครั้ง",
  not_student: "เฉพาะบัญชีนักเรียนเท่านั้นที่เข้าร่วมกิจกรรมได้",
  activity_not_open: "กิจกรรมนี้ยังไม่เปิดรับหรือปิดรับแล้ว เลือกกิจกรรมอื่นที่เปิดอยู่",
  activity_ended: "กิจกรรมนี้สิ้นสุดแล้ว เข้าร่วมไม่ได้",
  already_joined: "คุณเข้าร่วมกิจกรรมนี้แล้ว",
  not_staff: "เฉพาะครูและผู้ดูแลเท่านั้นที่ออกรหัสจุดชั่งได้",
  activity_not_found: "ไม่พบกิจกรรมนี้ อาจถูกลบไปแล้ว",
  code_not_required: "กิจกรรมนี้ไม่ต้องใช้รหัสจุดชั่ง",
  not_participant: "นักเรียนคนนี้ยังไม่ได้เข้าร่วมกิจกรรมนี้",
  out_of_window: "ออกรหัสไม่ได้ เพราะกิจกรรมยังไม่เริ่ม เป็นฉบับร่าง หรือเลยช่วงส่งผลแล้ว (สิ้นสุด + 3 วัน)",
  activity_has_submissions: "ลบไม่ได้ เพราะมีผู้ส่งผลแล้ว ให้ปิดกิจกรรมแทน",
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
