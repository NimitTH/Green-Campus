import type { ListConfig } from "@/app/_components/list/list-params";

// DESIGN-4 3 (/notifications, /staff/notifications): list configs shared by the query and the toolbar.
// Staff never receive activity notifications, so their type filter has no "กิจกรรม" option.

const SORTS = {
  date: { label: "วันที่", kind: "date", defaultDir: "desc" },
  name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
} as const;

export const STUDENT_NOTIFICATION_CONFIG = {
  sorts: SORTS,
  defaultSort: "date",
  filters: { type: { label: "ประเภท", options: { activity: "กิจกรรม", submission: "ผลที่ส่ง", order: "ออเดอร์" } } },
} satisfies ListConfig;

export const STAFF_NOTIFICATION_CONFIG = {
  sorts: SORTS,
  defaultSort: "date",
  filters: { type: { label: "ประเภท", options: { submission: "ผลที่ส่ง", order: "ออเดอร์" } } },
} satisfies ListConfig;

/** The notifications column behind each sort key. */
export const NOTIFICATION_SORT_COLUMN: Record<keyof typeof SORTS, string> = { date: "created_at", name: "title" };

const PREFIXES = ["activity", "submission", "order"];

/** The LIKE pattern for a type filter value (`order` -> `order_%`); null for "all" or anything unknown. */
export function typePrefix(value: string | undefined): string | null {
  return value !== undefined && PREFIXES.includes(value) ? `${value}_%` : null;
}
