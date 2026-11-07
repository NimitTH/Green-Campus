import type { ListConfig } from "@/app/_components/list/list-params";

// DESIGN-4 3 (/my-submissions): the list config, shared by the query and the toolbar. Search is on the activity title.

export const MY_SUBMISSION_CONFIG = {
  sorts: {
    date: { label: "วันที่ส่ง", kind: "date", defaultDir: "desc" },
    // status_rank: pending (1) -> approved (2) -> rejected (3)
    status: { label: "สถานะ", kind: "number", defaultDir: "asc" },
    points: { label: "แต้ม", kind: "number", defaultDir: "desc" },
    kg: { label: "กก.", kind: "number", defaultDir: "desc" },
    name: { label: "ชื่อกิจกรรม", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  views: true,
} satisfies ListConfig;

/** The my_submission_list column behind each sort key. */
export const MY_SUBMISSION_SORT_COLUMN: Record<keyof typeof MY_SUBMISSION_CONFIG.sorts, string> = {
  date: "created_at",
  status: "status_rank",
  points: "points",
  kg: "grams",
  name: "activity_title",
};
