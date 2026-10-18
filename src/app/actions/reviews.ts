"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/routes";
import { errorCodeFromDb, reviewErrorMessageTh } from "@/lib/errors";
import { rejectReasonError } from "@/lib/reviews/reason";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Reachable by direct POST with any payload: the caller is checked here (DAL) and
// approve_submission / reject_submission check everything again (staff, owner, pending, reason).

export type ReviewFormState = { error: string } | undefined;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fail(code: string | null): ReviewFormState {
  return { error: reviewErrorMessageTh(code) };
}

/**
 * useActionState action for the review screen. Fields: submissionId, decision ("approve" |
 * "reject") and reason (reject only). On success returns to the queue with a success message.
 */
export async function reviewSubmissionForm(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const id = text(formData, "submissionId");
  const decision = text(formData, "decision");
  if (!isUuid(id)) return fail("submission_not_found");
  if (decision !== "approve" && decision !== "reject") return fail(null);

  const user = await getCurrentUser();
  if (!user) return fail("not_authenticated");
  if (!isStaffRole(user.role)) return fail("not_staff");

  const supabase = await createServerClient();
  let result;
  if (decision === "approve") {
    result = await supabase.rpc("approve_submission", { p_submission_id: id });
  } else {
    const reason = text(formData, "reason");
    const reasonError = rejectReasonError(reason);
    if (reasonError) return fail(reasonError);
    result = await supabase.rpc("reject_submission", { p_submission_id: id, p_reason: reason.trim() });
  }
  if (result.error) {
    const code = errorCodeFromDb(result.error);
    if (!code) console.error(`${decision}_submission failed`, result.error.code, result.error.message);
    return fail(code);
  }

  revalidatePath("/staff/reviews");
  redirect(`/staff/reviews?done=${decision === "approve" ? "approved" : "rejected"}`);
}
