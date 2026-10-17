"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import {
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
      console.error("saveActivity update failed", error.code, error.message);
      return { error: GENERIC_ERROR_TH };
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
