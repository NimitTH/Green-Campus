"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { MAX_CART_QTY, checkCartQty } from "@/lib/rewards/validation";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Server Actions are reachable by direct POST: every action checks the caller itself (DAL) and
// the database enforces the same rules again (cart_items RLS, 0013). The cart does not reserve
// stock (spec 6.6): a quantity above the current stock is allowed, checkout re-validates.

const STUDENTS_ONLY = "เฉพาะบัญชีนักเรียนเท่านั้นที่ใช้ตะกร้าได้";
const NOT_SIGNED_IN = "กรุณาเข้าสู่ระบบก่อน แล้วลองอีกครั้ง";
const REWARD_INACTIVE = "ของรางวัลนี้ไม่เปิดให้แลกแล้ว";
const OUT_OF_STOCK = "ของรางวัลนี้หมดแล้ว ใส่ตะกร้าไม่ได้";
const NOT_IN_CART = "ไม่พบรายการนี้ในตะกร้า อาจถูกลบไปแล้ว";
const QTY_POSITIVE = "จำนวนต้องมากกว่า 0";
const MAX_TRIES = 3;

export type CartResult = { ok: true; error?: undefined } | { ok: false; error: string };

const fail = (error: string): CartResult => ({ ok: false, error });

/** Signed-in student, or the Thai error to return. */
async function studentOrError(): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: NOT_SIGNED_IN };
  if (user.role !== "student") return { error: STUDENTS_ONLY };
  return { id: user.id };
}

type DbError = { code?: string; message?: string };

/** RLS refusal (42501) on a cart write means the reward is not active. */
function writeError(action: string, error: DbError): CartResult {
  if (error.code === "42501") return fail(REWARD_INACTIVE);
  console.error(`${action} failed`, error.code, error.message);
  return fail(GENERIC_ERROR_TH);
}

/** Add `qty` of a reward to the cart, on top of what is already there (insert or update). */
export async function addToCart(rewardId: string, qty: number): Promise<CartResult> {
  if (!isUuid(rewardId)) return fail(REWARD_INACTIVE);
  const checked = checkCartQty(qty);
  if (!checked.ok) return fail(checked.error);
  if (checked.qty < 1) return fail(QTY_POSITIVE);

  const who = await studentOrError();
  if ("error" in who) return fail(who.error);

  const supabase = await createServerClient();
  // Students read active rewards only (RLS), so a missing row is an inactive or unknown reward.
  const { data: reward, error: rewardError } = await supabase
    .from("rewards")
    .select("active, stock")
    .eq("id", rewardId)
    .maybeSingle();
  if (rewardError) return writeError("addToCart reward", rewardError);
  const row = reward as { active: boolean; stock: number } | null;
  if (!row || !row.active) return fail(REWARD_INACTIVE);
  if (row.stock <= 0) return fail(OUT_OF_STOCK);

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const { data: existing, error: readError } = await supabase
      .from("cart_items")
      .select("id, qty")
      .eq("student_id", who.id)
      .eq("reward_id", rewardId)
      .maybeSingle();
    if (readError) return writeError("addToCart read", readError);
    const current = existing as { id: string; qty: number } | null;

    const next = (current?.qty ?? 0) + checked.qty;
    if (next > MAX_CART_QTY) return fail(`ใส่ตะกร้าได้ไม่เกิน ${MAX_CART_QTY} ชิ้นต่อรายการ`);

    if (current) {
      // The old qty in the filter makes two taps at once add up instead of overwriting each other.
      const { data: updated, error } = await supabase
        .from("cart_items")
        .update({ qty: next })
        .eq("id", current.id)
        .eq("qty", current.qty)
        .select("id");
      if (error) return writeError("addToCart update", error);
      if (updated && updated.length > 0) {
        refresh();
        return { ok: true };
      }
      continue; // changed meanwhile: read again
    }

    const { error } = await supabase
      .from("cart_items")
      .insert({ student_id: who.id, reward_id: rewardId, qty: next });
    if (!error) {
      refresh();
      return { ok: true };
    }
    if (error.code !== "23505") return writeError("addToCart insert", error);
    // unique (student, reward): another tap inserted first; read again and add on top
  }
  return fail(GENERIC_ERROR_TH);
}

/** Set the quantity of a line. qty <= 0 removes it. */
export async function setCartQty(rewardId: string, qty: number): Promise<CartResult> {
  if (!isUuid(rewardId)) return fail(NOT_IN_CART);
  const checked = checkCartQty(qty);
  if (!checked.ok) return fail(checked.error);

  const who = await studentOrError();
  if ("error" in who) return fail(who.error);

  const supabase = await createServerClient();
  if (checked.qty <= 0) return deleteLine(supabase, who.id, rewardId);

  const { data, error } = await supabase
    .from("cart_items")
    .update({ qty: checked.qty })
    .eq("student_id", who.id)
    .eq("reward_id", rewardId)
    .select("id");
  if (error) return writeError("setCartQty", error);
  if (!data || data.length === 0) return fail(NOT_IN_CART);
  refresh();
  return { ok: true };
}

/** Remove a line from the cart. Removing a line that is already gone is fine. */
export async function removeFromCart(rewardId: string): Promise<CartResult> {
  if (!isUuid(rewardId)) return fail(NOT_IN_CART);
  const who = await studentOrError();
  if ("error" in who) return fail(who.error);
  return deleteLine(await createServerClient(), who.id, rewardId);
}

async function deleteLine(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  studentId: string,
  rewardId: string,
): Promise<CartResult> {
  const { error } = await supabase.from("cart_items").delete().eq("student_id", studentId).eq("reward_id", rewardId);
  if (error) return writeError("removeFromCart", error);
  refresh();
  return { ok: true };
}
