"use client";

import { useActionState } from "react";
import { resolveProblemReport, type ResolveState } from "@/app/actions/problem-reports";
import { Button, inputClass } from "@/components/ui";

/** Round 6 (old-site features 5): mark one report done, with an optional note that the reporter receives. */
export function ResolveForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ResolveState, FormData>(resolveProblemReport, undefined);
  const noteId = `resolve-note-${id}`;
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="id" value={id} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={noteId} className="text-sm font-medium text-ink">
          หมายเหตุถึงผู้แจ้ง (ไม่บังคับ)
        </label>
        <input id={noteId} name="note" type="text" maxLength={500} className={inputClass} />
      </div>
      <Button type="submit" variant="primary" disabled={pending} className="shrink-0">
        ทำเครื่องหมายว่าแก้แล้ว
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
