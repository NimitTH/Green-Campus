import type { ListConfig } from "@/app/_components/list/list-params";

// DESIGN-4 3 (/activities): the list config, shared by the query (queries.ts) and the toolbar.

export const ACTIVITY_LIST_CONFIG = {
  sorts: {
    date: { label: "วันที่", kind: "date", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  filters: {
    joined: { label: "สถานะ", options: { yes: "เข้าร่วมแล้ว", no: "ยังไม่เข้าร่วม" } },
    type: { label: "ประเภท", options: { waste: "ชั่งน้ำหนัก", trees: "ปลูกต้นไม้", fixed: "แต้มคงที่" } },
  },
  views: true,
} satisfies ListConfig;

/** The activities column behind each sort key. */
export const ACTIVITY_SORT_COLUMN: Record<keyof typeof ACTIVITY_LIST_CONFIG.sorts, string> = {
  date: "created_at",
  name: "title",
};
