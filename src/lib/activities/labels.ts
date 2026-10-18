const TYPE_LABELS: Record<string, string> = {
  waste: "ชั่งน้ำหนักขยะ",
  trees: "ปลูกต้นไม้",
  fixed: "แต้มคงที่ต่อครั้ง",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "ฉบับร่าง",
  open: "เปิดรับ",
  closed: "ปิดแล้ว",
};

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  pending: "รอตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่ผ่าน",
};

function lookup(map: Record<string, string>, key: string): string {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : key;
}

export function typeLabelTh(type: string): string {
  return lookup(TYPE_LABELS, type);
}

export function statusLabelTh(status: string): string {
  return lookup(STATUS_LABELS, status);
}

export function submissionStatusLabelTh(status: string): string {
  return lookup(SUBMISSION_STATUS_LABELS, status);
}
