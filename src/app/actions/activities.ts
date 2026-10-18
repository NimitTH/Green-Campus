"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireStaff } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import {
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

export type SaveActivityResult =
  | { id: string; error?: undefined; fieldErrors?: undefined }
  | { id?: undefined; error?: string; fieldErrors?: ActivityFieldErrors };

/** Create (no id) or update (id) an activity. Staff only. */
export async function saveActivity(input: ActivityInput & { id?: string }): Promise<SaveActivityResult> {
  // Reachable by direct POST with any payload: check the shape before touching it.
  if (!isActivityInputShape(input)) return { error: GENERIC_ERROR_TH };
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { error: STAFF_ONLY };

  const result = validateActivity(input);
  if (!result.ok) return { fieldErrors: result.fieldErrors };

  const supabase = await createServerClient();
  if (input.id !== undefined) {
    if (!isUuid(input.id)) return { error: NOT_FOUND };
    const { data, error } = await supabase
      .from("activities")
      .update(result.value)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) {
      // activity_type_locked (R38): the type cannot change once a submission exists.
      const code = errorCodeFromDb(error);
      if (!code) console.error("saveActivity update failed", error.code, error.message);
      return { error: errorMessageTh(code) };
    }
    if (!data) return { error: NOT_FOUND };
    revalidatePath("/staff/activities");
    revalidatePath("/activities");
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
  revalidatePath("/staff/activities");
  revalidatePath("/activities");
  return { id: (data as { id: string }).id };
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
  const values: ActivityInput = {
    title: text(formData, "title"),
    description: text(formData, "description"),
    location: text(formData, "location"),
    isOffsite: formData.get("isOffsite") === "on",
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    status: text(formData, "status"),
    type: text(formData, "type"),
    requiresCode: formData.get("requiresCode") === "on",
    unitPoints: text(formData, "unitPoints"),
    unitCarbonKg: text(formData, "unitCarbonKg"),
    maxPerSubmission: text(formData, "maxPerSubmission"),
  };

  const result = await saveActivity(id ? { ...values, id } : values);
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
  const { data, error } = await supabase.from("activities").delete().eq("id", activityId).select("id");
  if (error) {
    const code = errorCodeFromDb(error);
    if (!code) console.error("deleteActivity failed", error.code, error.message);
    return { ok: false, error: errorMessageTh(code) };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };

  revalidatePath("/staff/activities");
  revalidatePath("/activities");
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
