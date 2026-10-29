"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { AVATAR_BUCKET, isOwnAvatarPath } from "@/lib/profile/avatar";
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
  revalidatePath("/staff/profile");
  revalidatePath("/staff");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type AvatarResult = { ok: true } | { ok: false; error: string };

const SIGN_IN_FIRST = "กรุณาเข้าสู่ระบบก่อน แล้วลองอีกครั้ง";

function revalidateAvatarPaths() {
  revalidatePath("/profile");
  revalidatePath("/staff/profile");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
}

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

async function currentAvatarPath(supabase: Supabase, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
  return (data as { avatar_path: string | null } | null)?.avatar_path ?? null;
}

async function removeObject(supabase: Supabase, path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.error("remove avatar object failed", error.message);
}

async function writeAvatarPath(supabase: Supabase, userId: string, path: string | null): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId).select("id");
  if (error) console.error("avatar update failed", error.code, error.message);
  return !error && !!data && data.length > 0;
}

/** Point profiles.avatar_path at an object the browser just uploaded to avatars/<uid>/<uuid>.jpg. */
export async function setAvatar(path: string): Promise<AvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGN_IN_FIRST };
  if (typeof path !== "string" || !isOwnAvatarPath(path, user.id)) return { ok: false, error: GENERIC_ERROR_TH };

  const supabase = await createServerClient();
  const oldPath = await currentAvatarPath(supabase, user.id);
  if (!(await writeAvatarPath(supabase, user.id, path))) return { ok: false, error: GENERIC_ERROR_TH };
  if (oldPath && oldPath !== path) await removeObject(supabase, oldPath);
  revalidateAvatarPaths();
  return { ok: true };
}

export async function removeAvatar(): Promise<AvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGN_IN_FIRST };

  const supabase = await createServerClient();
  const oldPath = await currentAvatarPath(supabase, user.id);
  if (!(await writeAvatarPath(supabase, user.id, null))) return { ok: false, error: GENERIC_ERROR_TH };
  await removeObject(supabase, oldPath);
  revalidateAvatarPaths();
  return { ok: true };
}
