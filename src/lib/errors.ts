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
  // submit_result (Task 8): returned as {ok: false, error_code}
  code_required: "กิจกรรมนี้ต้องใช้รหัส 6 หลักจากจุดชั่ง กรอกรหัสแล้วส่งอีกครั้ง",
  code_invalid:
    "รหัสไม่ถูกต้องหรือถูกใช้ไปแล้ว ถ้าเพิ่งกดส่งไป ให้ตรวจที่หน้า ผลที่ส่ง ก่อน ถ้ายังไม่มีผล ตรวจรหัสอีกครั้ง หรือขอรหัสใหม่ที่จุดชั่ง",
  code_expired: "รหัสหมดอายุแล้ว (ใช้ได้ 30 นาที) ขอรหัสใหม่ที่จุดชั่ง",
  code_locked: "กรอกรหัสผิดครบ 5 ครั้ง รหัสถูกล็อก ขอรหัสใหม่ที่จุดชั่ง",
  over_limit: "ปริมาณเกินที่กิจกรรมนี้รับได้ต่อการส่งหนึ่งครั้ง ลดปริมาณหรือแบ่งส่งหลายครั้ง",
  invalid_items: "ข้อมูลปริมาณไม่ถูกต้อง กรอกจำนวนที่มากกว่า 0 อย่างน้อยหนึ่งช่อง",
  bad_evidence_path: "ไม่พบรูปหลักฐานที่อัปโหลด กรุณาเลือกรูปแล้วส่งใหม่",
  // client-side (image resize / upload)
  not_image: "ไฟล์นี้ไม่ใช่รูปภาพหรือเปิดไม่ได้ กรุณาถ่ายหรือเลือกรูปใหม่",
  image_too_large: "รูปมีขนาดใหญ่เกิน 2 MB แม้ย่อแล้ว กรุณาถ่ายหรือเลือกรูปใหม่",
  upload_failed: "อัปโหลดรูปไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง",
  upload_unauthorized: "อัปโหลดรูปไม่ได้ เพราะการเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่ แล้วส่งอีกครั้ง",
  request_timeout:
    "ใช้เวลานานเกินไป ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง (ถ้าเพิ่งกดส่งไป ให้ตรวจที่หน้า ผลที่ส่ง ก่อน)",
};

// Codes shared with issue_weigh_code whose staff wording does not fit a student submitting.
const SUBMIT_MESSAGES: Record<string, string> = {
  not_participant: "คุณยังไม่ได้เข้าร่วมกิจกรรมนี้ กดเข้าร่วมกิจกรรมก่อนส่งผล",
  out_of_window: "ส่งผลไม่ได้ เพราะกิจกรรมยังไม่เริ่ม หรือเลยช่วงส่งผลแล้ว (ส่งได้ถึง 3 วันหลังกิจกรรมสิ้นสุด)",
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

/** errorMessageTh for the student submit form (submit_result error_code, image and upload errors). */
export function submitErrorMessageTh(code: string | null | undefined): string {
  if (code && Object.prototype.hasOwnProperty.call(SUBMIT_MESSAGES, code)) return SUBMIT_MESSAGES[code];
  return errorMessageTh(code);
}

type StorageErrorLike = { status?: number; statusCode?: string | number; message?: string | null };

/** Storage upload error -> upload_unauthorized (401/403, RLS or JWT problems) or upload_failed. */
export function uploadErrorCode(error: StorageErrorLike | null | undefined): "upload_unauthorized" | "upload_failed" {
  if (!error) return "upload_failed";
  const statuses = [error.status, Number(error.statusCode)];
  if (statuses.includes(401) || statuses.includes(403)) return "upload_unauthorized";
  if (/row-level security|unauthorized|jwt/i.test(error.message ?? "")) return "upload_unauthorized";
  return "upload_failed";
}
