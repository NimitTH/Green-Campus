// Display helpers for orders (Task 13, R78). Pure functions, shared by student and staff pages.

export type OrderStatus = "pending_pickup" | "completed" | "cancelled" | "expired";

const STATUS_TH: Record<OrderStatus, string> = {
  pending_pickup: "รอรับของ",
  completed: "รับแล้ว",
  cancelled: "ยกเลิก",
  expired: "หมดอายุ",
};

export function orderStatusLabelTh(status: string): string {
  return Object.prototype.hasOwnProperty.call(STATUS_TH, status) ? STATUS_TH[status as OrderStatus] : status;
}

/** Badge tone of a status. */
export function orderStatusTone(status: string): "amber" | "green" | "gray" {
  if (status === "pending_pickup") return "amber";
  if (status === "completed") return "green";
  return "gray";
}

/** A pending order past its pickup deadline (waiting for expire_orders). */
export function isOrderOverdue(status: string, expiresAt: string, now: number = Date.now()): boolean {
  return status === "pending_pickup" && Date.parse(expiresAt) <= now;
}

/** เลขที่ออเดอร์: the first 8 characters of the id, uppercased. */
export function orderNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** One blocked line from checkout() (R71). */
export type BlockedItem =
  | { reward_id: string; reason: "inactive" }
  | { reward_id: string; reason: "stock"; available: number }
  | { reward_id: null; reason: "points"; shortfall: number };

const number = new Intl.NumberFormat("th-TH");

/** Thai reason for a blocked line; `name` is the reward name the student saw in the cart. */
export function blockedReasonTh(item: BlockedItem, name: string | undefined): string {
  const label = name ?? "ของรางวัลนี้";
  switch (item.reason) {
    case "inactive":
      return `${label}: ปิดการแลกแล้ว ลบออกจากตะกร้าก่อน`;
    case "stock":
      return `${label}: สต็อกเหลือ ${number.format(item.available)} ชิ้น ลดจำนวนลงก่อน`;
    case "points":
      return `แต้มไม่พอ ขาดอีก ${number.format(item.shortfall)} แต้ม`;
  }
}

/** Parse the blocked array of a checkout() result, dropping anything unexpected. */
export function parseBlocked(value: unknown): BlockedItem[] {
  if (!Array.isArray(value)) return [];
  const out: BlockedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    if (v.reason === "inactive" && typeof v.reward_id === "string") out.push({ reward_id: v.reward_id, reason: "inactive" });
    else if (v.reason === "stock" && typeof v.reward_id === "string" && typeof v.available === "number")
      out.push({ reward_id: v.reward_id, reason: "stock", available: v.available });
    else if (v.reason === "points" && typeof v.shortfall === "number")
      out.push({ reward_id: null, reason: "points", shortfall: v.shortfall });
  }
  return out;
}

const HEX_RE = /^[0-9a-f]{1,32}$/;

/**
 * Staff search by order number prefix: "a1b2c3" (any case, dashes ignored) -> the uuid range
 * [a1b2c300-0000-..., a1b2c3ff-ffff-...]. null when the text is not a hex prefix.
 */
export function orderIdRange(query: string): { from: string; to: string } | null {
  const hex = query.trim().toLowerCase().replace(/-/g, "");
  if (!HEX_RE.test(hex)) return null;
  const shape = (s: string) => `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  return { from: shape(hex.padEnd(32, "0")), to: shape(hex.padEnd(32, "f")) };
}
