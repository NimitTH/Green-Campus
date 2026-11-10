import type { ListConfig } from "@/app/_components/list/list-params";

// DESIGN-4 3 (/rewards): the list config, shared by the query and the toolbar (STAFF_REWARD_CONFIG joins it in Task 10).

export const REWARD_CONFIG = {
  sorts: {
    date: { label: "วันที่เพิ่ม", kind: "date", defaultDir: "desc" },
    price: { label: "ราคา", kind: "number", defaultDir: "asc" },
    stock: { label: "ชิ้นที่เหลือ", kind: "number", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  views: true,
} satisfies ListConfig;

/** The rewards column behind each sort key. */
export const REWARD_SORT_COLUMN: Record<
  keyof typeof REWARD_CONFIG.sorts,
  string
> = {
  date: "created_at",
  price: "points_cost",
  stock: "stock",
  name: "name",
};

// DESIGN-4 3 (/cart): sorted and paged in the app (the whole cart is loaded once), so there is no column map.
export const CART_CONFIG = {
  sorts: {
    date: { label: "วันที่ใส่", kind: "date", defaultDir: "desc" },
    price: { label: "ราคา", kind: "number", defaultDir: "asc" },
    total: { label: "แต้มรวม", kind: "number", defaultDir: "desc" },
    qty: { label: "จำนวน", kind: "number", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
} satisfies ListConfig;

// DESIGN-4 4.4 (/staff/rewards): the staff list config; the staff see inactive rewards too.
export const STAFF_REWARD_CONFIG = {
  sorts: {
    date: { label: "วันที่เพิ่ม", kind: "date", defaultDir: "desc" },
    points: { label: "แต้ม", kind: "number", defaultDir: "asc" },
    stock: { label: "สต็อก", kind: "number", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  filters: { active: { label: "สถานะ", options: { yes: "เปิดการแลก", no: "ปิดการแลก" } } },
} satisfies ListConfig;

/** The rewards column behind each staff sort key. */
export const STAFF_REWARD_SORT_COLUMN: Record<keyof typeof STAFF_REWARD_CONFIG.sorts, string> = {
  date: "created_at",
  points: "points_cost",
  stock: "stock",
  name: "name",
};

/** The `active` value of the filter: yes → true, no → false; "all", missing and unknown add no filter (null). */
export function staffRewardActiveFilter(active: string | undefined): boolean | null {
  return active === "yes" ? true : active === "no" ? false : null;
}
