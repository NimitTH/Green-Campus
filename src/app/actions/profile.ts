"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { isProfileInputShape, validateProfile, type ProfileFieldErrors, type ProfileInput } from "@/lib/profile/validation";
import { createServerClient } from "@/lib/supabase/server";

// /profile (Task 18 Part B, R123). Runs with the caller's session: column grants (0002) allow only
// full_name / display_name, RLS only the caller's own row, and the 0019/0021 checks the same limits.

export type ProfileResult =
  | { ok: true; error?: undefined; fieldErrors?: undefined }
  | { ok: false; error?: string; fieldErrors?: ProfileFieldErrors };

const NAME_REJECTED = "บันทึกชื่อไม่ได้ ตรวจว่ากรอกชื่อ-นามสกุลแล้ว และความยาวไม่เกินที่กำหนด";

export async function updateProfile(input: ProfileInput): Promise<ProfileResult> {
  if (!isProfileInputShape(input)) return { ok: false, error: GENERIC_ERROR_TH };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบก่อน แล้วลองอีกครั้ง" };

  const result = validateProfile(input);
  if (!result.ok) return { ok: false, fieldErrors: result.fieldErrors };

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("profiles").update(result.value).eq("id", user.id).select("id");
  if (error) {
    if (error.code === "23514") return { ok: false, error: NAME_REJECTED };
    console.error("updateProfile failed", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR_TH };
  }
  if (!data || data.length === 0) return { ok: false, error: GENERIC_ERROR_TH };
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { ok: true };
}
