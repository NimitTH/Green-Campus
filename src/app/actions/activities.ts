"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVITY_BUCKET, isActivityCoverPath } from "@/lib/activities/cover";
import { getCurrentUser, requireStaff } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import {
  activityInputFromForm,
  isActivityInputShape,
  validateActivity,
  type ActivityFieldErrors,
  type ActivityInput,
} from "@/lib/activities/validation";
import { GENERIC_ERROR_TH, errorCodeFromDb, errorMessageTh } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Server Actions are reachable by direct POST: every action checks the caller itself
// (DAL) and the database enforces the same rules again (RLS, join_activity).

const STAFF_ONLY = "เฉพาะครูและผู้ดูแลเท่านั้นที่จัดการกิจกรรมได้";
const NOT_FOUND = "ไม่พบกิจกรรมนี้ อาจถูกลบไปแล้ว";
const BAD_IMAGE = "รูปปกไม่ถูกต้อง กรุณาเลือกรูปใหม่แล้วบันทึกอีกครั้ง";

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

async function removeCover(supabase: Supabase, path: string | null | undefined) {
  // Best effort, as for article covers: a leftover object only costs storage.
  if (path) await supabase.storage.from(ACTIVITY_BUCKET).remove([path]).catch(() => undefined);
}

// The home feed (lib/home/public-feed.ts) has no cache tag: it shows activity changes within cacheLife("minutes").
function revalidateActivities(id?: string) {
  revalidatePath("/staff/activities");
  revalidatePath("/activities");
  if (id) revalidatePath(`/activities/${id}`);
}

export type SaveActivityInput = ActivityInput & {
  id?: string;
  /** Update only: a new cover already uploaded to activity-images as {id}/{uuid}.jpg. */
  coverPath?: string | null;
  /** Update only: drop the current cover (ignored when coverPath is set). */
  removeCover?: boolean;
};

export type SaveActivityResult =
  | { id: string; error?: undefined; fieldErrors?: undefined }
  | { id?: undefined; error?: string; fieldErrors?: ActivityFieldErrors };

/**
 * Create (no id) or update (id) an activity. Staff only. A cover needs the id, so a new activity with a cover is
 * inserted first; the browser then uploads the cover under that id and saves again with coverPath (DESIGN-3 6.1).
 * Replacing or removing a cover deletes the old object.
 */
export async function saveActivity(input: SaveActivityInput): Promise<SaveActivityResult> {
  // Reachable by direct POST with any payload: check the shape before touching it.
  if (!isActivityInputShape(input)) return { error: GENERIC_ERROR_TH };
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { error: STAFF_ONLY };

  const result = validateActivity(input);
  if (!result.ok) return { fieldErrors: result.fieldErrors };

  const coverPath = input.coverPath ?? null;
  if (coverPath !== null && (input.id === undefined || !isActivityCoverPath(coverPath, input.id))) {
    return { error: BAD_IMAGE };
  }

  const supabase = await createServerClient();
  if (input.id !== undefined) {
    if (!isUuid(input.id)) return { error: NOT_FOUND };
    const cover = coverPath ? { cover_path: coverPath } : input.removeCover ? { cover_path: null } : {};
    let previousCover: string | null = null;
    if ("cover_path" in cover) {
      const { data: before } = await supabase.from("activities").select("cover_path").eq("id", input.id).maybeSingle();
      previousCover = (before as { cover_path: string | null } | null)?.cover_path ?? null;
    }
    const { data, error } = await supabase
      .from("activities")
      .update({ ...result.value, ...cover })
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) {
      // activity_type_locked (R38) and activity_status_locked (no back to draft once joined) map to Thai here.
      const code = errorCodeFromDb(error);
      if (!code) console.error("saveActivity update failed", error.code, error.message);
      return { error: errorMessageTh(code) };
    }
    if (!data) return { error: NOT_FOUND };
    if (previousCover && previousCover !== coverPath) await removeCover(supabase, previousCover);
    revalidateActivities(input.id);
    return { id: (data as { id: string }).id };
  }

  const { data, error } = await supabase
    .from("activities")
    .insert({ ...result.value, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("saveActivity insert failed", error?.code, error?.message);
    return { error: GENERIC_ERROR_TH };
  }
  const newId = (data as { id: string }).id;
  revalidateActivities(newId);
  return { id: newId };
}

export type ActivityFormState =
  | { error?: string; fieldErrors?: ActivityFieldErrors; values?: ActivityInput }
  | undefined;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** useActionState wrapper for the staff create/edit form. Redirects to the list on success. */
export async function saveActivityForm(
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const id = text(formData, "id").trim();
  const values = activityInputFromForm(formData);
  const removeCover = formData.get("removeCover") === "on";

  const result = await saveActivity(id ? { ...values, id, removeCover } : values);
  if (result.id === undefined) {
    return { error: result.error, fieldErrors: result.fieldErrors, values };
  }
  redirect("/staff/activities");
}

export type JoinActivityResult =
  | { ok: true; code?: undefined; error?: undefined }
  | { ok: false; code: string | null; error: string };

function joinError(code: string | null): JoinActivityResult {
  return { ok: false, code, error: errorMessageTh(code) };
}

/** Join an activity through join_activity (spec 6.3). Error codes become Thai messages. */
export async function joinActivity(activityId: string): Promise<JoinActivityResult> {
  if (!isUuid(activityId)) return joinError("activity_not_open");
  const user = await getCurrentUser();
  if (!user) return joinError("not_authenticated");

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("join_activity", { p_activity_id: activityId });
  if (error) {
    const code = errorCodeFromDb(error);
    if (!code) console.error("join_activity failed", error.code, error.message);
    return joinError(code);
  }
  refresh();
  return { ok: true };
}

export type JoinFormState = JoinActivityResult | undefined;

/** useActionState wrapper for the join button (hidden input "activityId"). */
export async function joinActivityForm(_prev: JoinFormState, formData: FormData): Promise<JoinFormState> {
  return joinActivity(text(formData, "activityId"));
}

export type DeleteActivityResult = { ok: true; error?: undefined } | { ok: false; error: string };

/**
 * Delete an activity (teacher or admin, ruling R17). The database refuses activities with
 * submissions (23503 activity_has_submissions); participations are removed with it.
 */
export async function deleteActivity(activityId: string): Promise<DeleteActivityResult> {
  await requireStaff("/staff/activities");
  if (!isUuid(activityId)) return { ok: false, error: NOT_FOUND };

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("activities").delete().eq("id", activityId).select("id, cover_path");
  if (error) {
    const code = errorCodeFromDb(error);
    if (!code) console.error("deleteActivity failed", error.code, error.message);
    return { ok: false, error: errorMessageTh(code) };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };
  await removeCover(supabase, (data[0] as { cover_path: string | null }).cover_path);

  revalidateActivities(activityId);
  return { ok: true };
}

export type DeleteActivityFormState = DeleteActivityResult | undefined;

/** useActionState wrapper for the delete confirmation (hidden input "activityId"). */
export async function deleteActivityForm(
  _prev: DeleteActivityFormState,
  formData: FormData,
): Promise<DeleteActivityFormState> {
  const result = await deleteActivity(text(formData, "activityId"));
  if (!result.ok) return result;
  redirect("/staff/activities");
}
