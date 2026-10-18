"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { submitErrorMessageTh } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Reachable by direct POST with any payload: the shape is checked here and submit_result
// checks everything again (participant, window, items, evidence path, weigh code).

export type SubmitItem = { waste_category_id?: string; quantity: number };
export type SubmitResultInput = {
  activityId: string;
  code: string | null;
  items: SubmitItem[];
  evidencePath: string;
};
export type SubmitResultOutcome =
  | { ok: true; submissionId: string; code?: undefined; error?: undefined }
  | { ok: false; code: string | null; error: string; submissionId?: undefined };

function fail(code: string | null): SubmitResultOutcome {
  return { ok: false, code, error: submitErrorMessageTh(code) };
}

function isItems(value: unknown): value is SubmitItem[] {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as SubmitItem).quantity === "number" &&
        ((item as SubmitItem).waste_category_id === undefined || isUuid((item as SubmitItem).waste_category_id)),
    )
  );
}

/** Send a result through submit_result (spec 7.1). The photo must already be uploaded. */
export async function submitResult(input: SubmitResultInput): Promise<SubmitResultOutcome> {
  if (input === null || typeof input !== "object" || !isUuid(input.activityId)) return fail("not_participant");
  if (!isItems(input.items)) return fail("invalid_items");
  if (typeof input.evidencePath !== "string" || input.evidencePath.length > 500) return fail("bad_evidence_path");
  if (input.code !== null && typeof input.code !== "string") return fail("code_invalid");

  const user = await getCurrentUser();
  if (!user) return fail("not_authenticated");
  if (user.role !== "student") return fail("not_student");

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("submit_result", {
    p_activity_id: input.activityId,
    p_code: input.code,
    p_items: input.items,
    p_evidence_path: input.evidencePath,
  });
  if (error) {
    const code = error.message?.trim();
    if (code === "not_authenticated" || code === "not_student") return fail(code);
    console.error("submit_result failed", error.code, error.message);
    return fail(null);
  }
  const result = data as { ok: boolean; error_code: string | null; submission_id: string | null } | null;
  if (result?.ok && result.submission_id) return { ok: true, submissionId: result.submission_id };
  return fail(result?.error_code ?? null);
}
