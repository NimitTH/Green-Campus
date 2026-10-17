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

function lookup(map: Record<string, string>, key: string): string {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : key;
}

export function typeLabelTh(type: string): string {
  return lookup(TYPE_LABELS, type);
}

export function statusLabelTh(status: string): string {
  return lookup(STATUS_LABELS, status);
}
