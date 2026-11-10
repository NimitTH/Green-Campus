import type { ListConfig } from "@/app/_components/list/list-params";
import {
  quoteOrValue,
  toIlikePattern,
} from "@/app/_components/list/search-escape";
import { orderIdRange } from "./format";

// DESIGN-4 3 (/orders): the list config, shared by the query and the toolbar. Search covers the item names and
// the order number (the prefix search staff use).

export const MY_ORDER_CONFIG = {
  sorts: { date: { label: "วันที่", kind: "date", defaultDir: "desc" } },
  defaultSort: "date",
} satisfies ListConfig;

/** The my_order_list column behind each sort key. */
export const MY_ORDER_SORT_COLUMN: Record<
  keyof typeof MY_ORDER_CONFIG.sorts,
  string
> = { date: "created_at" };

/** The `.or()` filter for the search text: item names (literal ilike), plus the order-number range when `q` is a hex prefix. */
export function orderSearchFilter(q: string): string {
  const parts = [`item_names.ilike.${quoteOrValue(toIlikePattern(q))}`];
  const range = orderIdRange(q);
  if (range) parts.push(`and(id.gte.${range.from},id.lte.${range.to})`);
  return parts.join(",");
}

// DESIGN-4 4.4 (/staff/orders): the staff list config, read from the staff_order_list view. The default status
// "open" (every pending_pickup order) with date ascending shows the longest-waiting order first, as before.
export const STAFF_ORDER_CONFIG = {
  sorts: {
    date: { label: "วันที่สั่ง", kind: "date", defaultDir: "asc" },
    points: { label: "แต้ม", kind: "number", defaultDir: "desc" },
    buyer: { label: "ชื่อผู้สั่ง", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  filters: {
    status: {
      label: "สถานะ",
      defaultValue: "open",
      options: {
        open: "รอรับทั้งหมด",
        preparing: "รอเตรียม",
        ready: "เตรียมของเสร็จ",
        completed: "รับแล้ว",
        closed: "ยกเลิก-หมดอายุ",
      },
    },
  },
} satisfies ListConfig;

/** The staff_order_list column behind each sort key. */
export const STAFF_ORDER_SORT_COLUMN: Record<keyof typeof STAFF_ORDER_CONFIG.sorts, string> = {
  date: "created_at",
  points: "total_points",
  buyer: "buyer_name",
};

export type StaffOrderFilter = [column: string, op: "eq", value: string];

/** The column filter of the status value: open = pending_pickup, the groups map to status_group, "all" adds none. A missing or unknown value is the default (open). */
export function staffOrderFilter(status: string | undefined): StaffOrderFilter | null {
  if (status === "all") return null;
  if (status !== undefined && status !== "open" && Object.hasOwn(STAFF_ORDER_CONFIG.filters.status.options, status)) return ["status_group", "eq", status];
  return ["status", "eq", "pending_pickup"];
}

/** The `.or()` filter for the staff search text: the buyer's full or display name (literal ilike), plus the order-number range when `q` is a hex prefix. */
export function staffOrderSearchFilter(q: string): string {
  const pattern = quoteOrValue(toIlikePattern(q));
  const parts = [`buyer_full_name.ilike.${pattern}`, `buyer_display_name.ilike.${pattern}`];
  const range = orderIdRange(q);
  if (range) parts.push(`and(id.gte.${range.from},id.lte.${range.to})`);
  return parts.join(",");
}
