// Pure validation for the staff reward form and the cart (spec 5 rewards, 6.6 cart).
// Form values are strings.

export const REWARD_LIMITS = {
  nameMax: 100,
  pointsCostMax: 10_000_000,
  stockMax: 100_000_000,
} as const;

/** Largest quantity of one reward in a cart (R65). */
export const MAX_CART_QTY = 99;

export type RewardInput = {
  name: string;
  pointsCost: string;
  stock: string;
  active: boolean;
};

/** Columns written to public.rewards (image_path is set separately, after the upload). */
export type RewardRecord = {
  name: string;
  points_cost: number;
  stock: number;
  active: boolean;
};

export type RewardFieldErrors = Partial<Record<keyof RewardInput, string>>;

export type RewardValidation =
  | { ok: true; value: RewardRecord }
  | { ok: false; fieldErrors: RewardFieldErrors };

/** Runtime shape check for Server Action input (reachable by direct POST with any payload). */
export function isRewardInputShape(value: unknown): value is RewardInput & { id?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || typeof v.pointsCost !== "string" || typeof v.stock !== "string") return false;
  if (typeof v.active !== "boolean") return false;
  if (v.id !== undefined && typeof v.id !== "string") return false;
  return true;
}

const INTEGER_RE = /^\d{1,12}$/;

export function validateReward(input: RewardInput): RewardValidation {
  const errors: RewardFieldErrors = {};

  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) errors.name = "กรอกชื่อของรางวัล";
  else if (name.length > REWARD_LIMITS.nameMax) errors.name = `ชื่อยาวได้ไม่เกิน ${REWARD_LIMITS.nameMax} ตัวอักษร`;

  const pointsText = input.pointsCost.trim();
  let pointsCost = 0;
  if (!INTEGER_RE.test(pointsText) || Number(pointsText) < 1 || Number(pointsText) > REWARD_LIMITS.pointsCostMax) {
    errors.pointsCost = `แต้มต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง ${REWARD_LIMITS.pointsCostMax.toLocaleString("th-TH")}`;
  } else pointsCost = Number(pointsText);

  const stockText = input.stock.trim();
  let stock = 0;
  if (!INTEGER_RE.test(stockText) || Number(stockText) > REWARD_LIMITS.stockMax) {
    errors.stock = `สต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง ${REWARD_LIMITS.stockMax.toLocaleString("th-TH")}`;
  } else stock = Number(stockText);

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value: { name, points_cost: pointsCost, stock, active: input.active } };
}

/** A stored reward row -> form values (edit page). */
export function rewardToInput(row: { name: string; points_cost: number; stock: number; active: boolean }): RewardInput {
  return { name: row.name, pointsCost: String(row.points_cost), stock: String(row.stock), active: row.active };
}

export type CartQtyCheck = { ok: true; qty: number } | { ok: false; error: string };

/** An integer quantity no larger than MAX_CART_QTY. Zero and below are allowed here (they remove the line). */
export function checkCartQty(qty: unknown): CartQtyCheck {
  if (typeof qty !== "number" || !Number.isInteger(qty)) return { ok: false, error: "จำนวนต้องเป็นจำนวนเต็ม" };
  if (qty > MAX_CART_QTY) return { ok: false, error: `ใส่ตะกร้าได้ไม่เกิน ${MAX_CART_QTY} ชิ้นต่อรายการ` };
  return { ok: true, qty };
}
