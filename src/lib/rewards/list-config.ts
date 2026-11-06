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
