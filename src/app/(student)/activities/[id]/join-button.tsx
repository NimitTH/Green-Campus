"use client";

import { useActionState } from "react";
import { joinActivityForm, type JoinFormState } from "@/app/actions/activities";

const buttonClass =
  "w-full rounded-lg px-4 py-3 text-base font-semibold disabled:cursor-not-allowed sm:w-auto";

/** Join button; shows "เข้าร่วมแล้ว" (disabled) once the student has joined. */
export function JoinButton({ activityId, joined }: { activityId: string; joined: boolean }) {
  const [state, action, pending] = useActionState<JoinFormState, FormData>(joinActivityForm, undefined);
  const isJoined = joined || state?.ok === true || state?.code === "already_joined";

  if (isJoined) {
    return (
      <div>
        <button type="button" disabled className={`${buttonClass} bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300`}>
          เข้าร่วมแล้ว
        </button>
        {state?.ok ? (
          <p role="status" className="mt-2 text-sm text-green-700">
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
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} bg-green-700 text-white hover:bg-green-800 disabled:opacity-60`}
      >
        {pending ? "กำลังเข้าร่วม..." : "เข้าร่วมกิจกรรม"}
      </button>
    </form>
  );
}
