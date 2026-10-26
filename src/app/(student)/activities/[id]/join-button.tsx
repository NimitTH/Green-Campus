"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { joinActivityForm, type JoinFormState } from "@/app/actions/activities";

/** Join button; shows "เข้าร่วมแล้ว" (disabled) once the student has joined. */
export function JoinButton({ activityId, joined }: { activityId: string; joined: boolean }) {
  const [state, action, pending] = useActionState<JoinFormState, FormData>(joinActivityForm, undefined);
  const isJoined = joined || state?.ok === true || state?.code === "already_joined";

  if (isJoined) {
    return (
      <div>
        <Button type="button" variant="card" size="lg" disabled className="w-full sm:w-auto">
          เข้าร่วมแล้ว
        </Button>
        {state?.ok ? (
          <p role="status" className="mt-2 text-sm text-accent">
            เข้าร่วมกิจกรรมเรียบร้อย
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="activityId" value={activityId} />
      {state?.error ? (
        <p role="alert" className="mb-3 rounded-input border border-danger p-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "กำลังเข้าร่วม..." : "เข้าร่วมกิจกรรม"}
      </Button>
    </form>
  );
}
