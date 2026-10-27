"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
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
      <Button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={`${label} ${name}`}
        variant="card"
      >
        {pending ? "กำลังบันทึก..." : label}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
