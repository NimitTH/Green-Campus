"use client";

import { useState, useTransition } from "react";
import { setRewardActive } from "@/app/actions/rewards";

/** Turn a reward on or off for redemption. */
export function ActiveToggle({ rewardId, name, active }: { rewardId: string; name: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = active ? "ปิดการแลก" : "เปิดให้แลก";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setRewardActive(rewardId, !active);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={`${label} ${name}`}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-900"
      >
        {pending ? "กำลังบันทึก..." : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
