// Error codes raised by database functions (message = the code) mapped to Thai text
// that tells the user what to do next (spec 9). Shared by join (Task 6), submit (Task 8) and review (Task 9).

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
  already_submitted: "คุณส่งผลกิจกรรมนี้ไปแล้ว ดูสถานะได้ที่หน้า ผลที่ส่ง",
  evidence_already_used:
    "รูปนี้ถูกใช้ส่งผลไปแล้ว ให้ตรวจที่หน้า ผลที่ส่ง ก่อน ถ้ายังไม่มีผลนั้น เลือกรูปใหม่แล้วส่งอีกครั้ง",
  // approve_submission / reject_submission (Task 9): raised, message = code
  submission_not_found: "ไม่พบผลที่ส่งนี้ อาจถูกลบไปแล้ว กลับไปที่คิวรอตรวจ",
  not_pending: "ผลนี้ถูกตรวจไปแล้ว รีเฟรชหน้าเพื่อดูสถานะล่าสุด",
  own_submission: "ตรวจผลของตัวเองไม่ได้ ให้ครูหรือผู้ดูแลคนอื่นตรวจแทน",
  reason_required: "กรุณากรอกเหตุผลที่ไม่ผ่าน เพื่อให้นักเรียนรู้ว่าต้องแก้อะไร",
  reason_too_long: "เหตุผลยาวเกิน 500 ตัวอักษร กรุณาเขียนให้สั้นลง",
  points_out_of_range:
    "ปริมาณในผลนี้สูงผิดปกติจนคำนวณแต้มไม่ได้ ตรวจรูปและตัวเลขอีกครั้ง แล้วติดต่อผู้ดูแลระบบ หรือกดไม่ผ่านพร้อมเหตุผล",
  // checkout / complete_order / cancel_order / expire_orders (Task 13, R71-R75)
  cart_empty: "ตะกร้าว่าง เลือกของรางวัลก่อน แล้วกดยืนยันแลกอีกครั้ง",
  blocked: "แลกไม่ได้ เพราะบางรายการในตะกร้าติดปัญหา แก้ตามที่แจ้งแล้วกดยืนยันแลกอีกครั้ง",
  order_not_found: "ไม่พบออเดอร์นี้ อาจถูกลบไปแล้ว รีเฟรชหน้าเพื่อดูรายการล่าสุด",
  order_not_pending: "ออเดอร์นี้ถูกรับของ ยกเลิก หรือหมดอายุไปแล้ว รีเฟรชหน้าเพื่อดูสถานะล่าสุด",
  order_already_ready: "ออเดอร์นี้ถูกทำเครื่องหมายว่าเตรียมของเสร็จแล้ว รีเฟรชหน้าเพื่อดูสถานะล่าสุด",
  order_expired: "ออเดอร์นี้เลยกำหนดรับของ 7 วันแล้ว ยืนยันรับไม่ได้ ให้ยกเลิกออเดอร์ (ระบบคืนแต้มและสต็อกให้)",
  not_admin: "เฉพาะผู้ดูแลระบบเท่านั้นที่ทำรายการนี้ได้",
  // set_user_role / adjust_ledger / waste_categories (Task 18, R113-R115)
  invalid_role: "บทบาทไม่ถูกต้อง เลือก นักเรียน ครู หรือ ผู้ดูแลระบบ",
  user_not_found: "ไม่พบผู้ใช้นี้ อาจถูกลบไปแล้ว รีเฟรชหน้าเพื่อดูรายการล่าสุด",
  demo_forbidden: "บัญชีสาธิตเปลี่ยนบทบาทของผู้ดูแลระบบจริง หรือแต่งตั้งผู้ดูแลระบบไม่ได้",
  last_admin:
    "เปลี่ยนไม่ได้ เพราะต้องเหลือผู้ดูแลระบบ (ที่ไม่ใช่บัญชีสาธิต) อย่างน้อย 1 คน ให้แต่งตั้งคนอื่นเป็นผู้ดูแลระบบก่อน",
  not_student_target: "ปรับแต้มได้เฉพาะบัญชีนักเรียนเท่านั้น",
  note_required: "ต้องระบุเหตุผลในการปรับแต้ม",
  note_too_long: "เหตุผลยาวเกิน 500 ตัวอักษร กรุณาเขียนให้สั้นลง",
  empty_adjust: "กรอกแต้มหรือ carbon ที่จะปรับอย่างน้อยหนึ่งช่อง (ต้องไม่เป็น 0)",
  invalid_adjust: "จำนวนที่กรอกไม่ถูกต้อง ตรวจแต้มและ carbon อีกครั้ง",
  insufficient_balance: "แต้มคงเหลือไม่พอ หักได้ไม่เกินแต้มที่นักเรียนมีอยู่",
  insufficient_carbon: "carbon สะสมไม่พอ หักได้ไม่เกิน carbon สะสมของนักเรียน",
  category_code_immutable: "เปลี่ยนรหัสของกลุ่มขยะไม่ได้ แก้ได้เฉพาะชื่อ อัตรา และที่มาของค่า",
  // trigger on activities (Task 9, R38)
  activity_status_locked: "เปลี่ยนกลับเป็นฉบับร่างไม่ได้ เพราะมีนักเรียนเข้าร่วมแล้ว ให้ปิดกิจกรรมแทน",
  activity_type_locked: "เปลี่ยนชนิดกิจกรรมไม่ได้ เพราะมีผู้ส่งผลแล้ว ถ้าต้องการชนิดอื่นให้สร้างกิจกรรมใหม่",
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

// not_staff from issue_weigh_code is worded for the weigh station.
const REVIEW_MESSAGES: Record<string, string> = {
  not_staff: "เฉพาะครูและผู้ดูแลเท่านั้นที่ตรวจผลได้",
};

// Wording for checkout (student) and the staff order screen.
const ORDER_MESSAGES: Record<string, string> = {
  not_student: "เฉพาะบัญชีนักเรียนเท่านั้นที่แลกของรางวัลได้",
  not_staff: "เฉพาะครูและผู้ดูแลเท่านั้นที่จัดการออเดอร์ได้",
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

/** errorMessageTh for the staff review screen (approve_submission / reject_submission codes). */
export function reviewErrorMessageTh(code: string | null | undefined): string {
  if (code && Object.prototype.hasOwnProperty.call(REVIEW_MESSAGES, code)) return REVIEW_MESSAGES[code];
  return errorMessageTh(code);
}

/** errorMessageTh for checkout and the order screens (checkout / complete / cancel / expire codes). */
export function orderErrorMessageTh(code: string | null | undefined): string {
  if (code && Object.prototype.hasOwnProperty.call(ORDER_MESSAGES, code)) return ORDER_MESSAGES[code];
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
