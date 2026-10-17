import { formatBangkok } from "@/lib/datetime";

/** Start-end of an activity in Bangkok time. */
export function ActivityDates({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  return (
    <span>
      {formatBangkok(startsAt)} – {formatBangkok(endsAt)}
    </span>
  );
}

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "amber" }) {
  const style = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}
