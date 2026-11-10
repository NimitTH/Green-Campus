import type { ListConfig } from "@/app/_components/list/list-params";
import { quoteOrValue, toIlikePattern } from "@/app/_components/list/search-escape";

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

// DESIGN-4 3 (/staff/activities): the staff list config, read from the staff_activity_list view.
export const STAFF_ACTIVITY_CONFIG = {
  sorts: {
    date: { label: "วันที่สร้าง", kind: "date", defaultDir: "desc" },
    participants: { label: "จำนวนผู้เข้าร่วม", kind: "number", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  filters: {
    type: { label: "ประเภท", options: { waste: "ชั่งน้ำหนัก", trees: "ปลูกต้นไม้", fixed: "แต้มคงที่" } },
    status: { label: "สถานะ", options: { draft: "ร่าง", open: "เปิดรับ", closed: "ปิดรับ" } },
    code: { label: "รหัสจุดชั่ง", options: { yes: "ใช้รหัสจุดชั่ง", no: "ไม่ใช้" } },
  },
} satisfies ListConfig;

/** The staff_activity_list column behind each sort key. */
export const STAFF_ACTIVITY_SORT_COLUMN: Record<keyof typeof STAFF_ACTIVITY_CONFIG.sorts, string> = {
  date: "created_at",
  participants: "participant_count",
  name: "title",
};

export type StaffActivityFilter = [column: string, op: "eq", value: string | boolean];

/** The column filters of a staff list state ("all", missing and unknown values add none). */
export function staffActivityFilters(filters: Record<string, string>): StaffActivityFilter[] {
  const out: StaffActivityFilter[] = [];
  const { type, status, code } = STAFF_ACTIVITY_CONFIG.filters;
  const known = (spec: { options: Record<string, string> }, v: string | undefined): v is string => v !== undefined && Object.hasOwn(spec.options, v);
  if (known(type, filters.type)) out.push(["type", "eq", filters.type]);
  if (known(status, filters.status)) out.push(["status", "eq", filters.status]);
  if (known(code, filters.code)) out.push(["requires_code", "eq", filters.code === "yes"]);
  return out;
}

/** The `.or()` filter for the staff search text: the title only (DESIGN-4 4.4), matched literally. */
export function staffActivitySearchFilter(q: string): string {
  return `title.ilike.${quoteOrValue(toIlikePattern(q))}`;
}
