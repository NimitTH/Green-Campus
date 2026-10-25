import { formatBangkok } from "@/lib/datetime";

/** Start-end of an activity in Bangkok time. */
export function ActivityDates({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  return (
    <span>
      {formatBangkok(startsAt)} – {formatBangkok(endsAt)}
    </span>
  );
}

export { Badge } from "@/components/ui";
