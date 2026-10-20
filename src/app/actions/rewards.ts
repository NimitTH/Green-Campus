"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { isAdminRole, isStaffRole } from "@/lib/auth/routes";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import {
  isRewardInputShape,
  validateReward,
  type RewardFieldErrors,
  type RewardInput,
} from "@/lib/rewards/validation";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Server Actions are reachable by direct POST: every action checks the caller itself (DAL) and
// the database enforces the same rules again (rewards RLS, 0002; storage policies, 0013).

const STAFF_ONLY = "เฉพาะครูและผู้ดูแลเท่านั้นที่จัดการของรางวัลได้";
const ADMIN_ONLY = "เฉพาะผู้ดูแลระบบเท่านั้นที่ลบของรางวัลได้ ครูปิดการแลกแทนได้";
const NOT_FOUND = "ไม่พบของรางวัลนี้ อาจถูกลบไปแล้ว";
const HAS_ORDERS = "ลบไม่ได้ เพราะมีคนแลกไปแล้ว ให้ปิดการแลกแทน";
const BAD_IMAGE = "รูปของรางวัลไม่ถูกต้อง กรุณาเลือกรูปใหม่แล้วบันทึกอีกครั้ง";
const IMAGE_PATH_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;

export type SaveRewardInput = RewardInput & {
  /** The reward id. Create: chosen by the browser (it uploads the image under it first). */
  id: string;
  mode: "create" | "update";
  /** Object path in reward-images ({id}/{uuid}.jpg) when a new image was uploaded. */
  imagePath?: string | null;
};

export type SaveRewardResult =
  | { ok: true; id: string; previousImagePath?: string | null; error?: undefined; fieldErrors?: undefined }
  | { ok: false; id?: undefined; error?: string; fieldErrors?: RewardFieldErrors };

function isSaveInput(value: unknown): value is SaveRewardInput {
  if (!isRewardInputShape(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  if (typeof v.id !== "string" || (v.mode !== "create" && v.mode !== "update")) return false;
  return v.imagePath === undefined || v.imagePath === null || typeof v.imagePath === "string";
}

/** Create or update a reward. Staff only. Returns the previous image path on update, for cleanup. */
export async function saveReward(
  input: SaveRewardInput,
): Promise<SaveRewardResult> {
  if (!isSaveInput(input)) return { ok: false, error: GENERIC_ERROR_TH };
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { ok: false, error: STAFF_ONLY };
  if (!isUuid(input.id)) return { ok: false, error: NOT_FOUND };

  const result = validateReward(input);
  if (!result.ok) return { ok: false, fieldErrors: result.fieldErrors };

  const imagePath = input.imagePath ?? null;
  if (imagePath !== null) {
    const match = IMAGE_PATH_RE.exec(imagePath);
    if (!match || match[1].toLowerCase() !== input.id.toLowerCase()) return { ok: false, error: BAD_IMAGE };
  }

  const supabase = await createServerClient();
  if (input.mode === "update") {
    const { data: before } = await supabase.from("rewards").select("image_path").eq("id", input.id).maybeSingle();
    const { data, error } = await supabase
      .from("rewards")
      .update(imagePath ? { ...result.value, image_path: imagePath } : result.value)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("saveReward update failed", error.code, error.message);
      return { ok: false, error: GENERIC_ERROR_TH };
    }
    if (!data) return { ok: false, error: NOT_FOUND };
    revalidateRewardPages();
    const previous = (before as { image_path: string | null } | null)?.image_path ?? null;
    return { ok: true, id: input.id, previousImagePath: imagePath && previous !== imagePath ? previous : null };
  }

  const { error } = await supabase
    .from("rewards")
    .insert({ ...result.value, id: input.id, image_path: imagePath });
  if (error) {
    console.error("saveReward insert failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  revalidateRewardPages();
  return { ok: true, id: input.id };
}

export type RewardActionResult = { ok: true; error?: undefined } | { ok: false; error: string };

/** Turn a reward on or off for redemption (staff). */
export async function setRewardActive(rewardId: string, active: boolean): Promise<RewardActionResult> {
  if (!isUuid(rewardId) || typeof active !== "boolean") return { ok: false, error: NOT_FOUND };
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { ok: false, error: STAFF_ONLY };

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("rewards").update({ active }).eq("id", rewardId).select("id");
  if (error) {
    console.error("setRewardActive failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };
  revalidateRewardPages();
  return { ok: true };
}

/** Delete a reward (admin only). A reward that was ordered cannot be deleted (23503). */
export async function deleteReward(rewardId: string): Promise<RewardActionResult> {
  if (!isUuid(rewardId)) return { ok: false, error: NOT_FOUND };
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { ok: false, error: STAFF_ONLY };
  if (!isAdminRole(user.role)) return { ok: false, error: ADMIN_ONLY };

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("rewards").delete().eq("id", rewardId).select("id, image_path");
  if (error) {
    if (error.code === "23503") return { ok: false, error: HAS_ORDERS };
    console.error("deleteReward failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };

  // Best effort: a leftover object is cleaned up by Task 19.
  const imagePath = (data[0] as { image_path: string | null }).image_path;
  if (imagePath) await supabase.storage.from("reward-images").remove([imagePath]).catch(() => undefined);
  revalidateRewardPages();
  return { ok: true };
}

function revalidateRewardPages() {
  revalidatePath("/staff/rewards");
  revalidatePath("/rewards");
  revalidatePath("/cart");
}
