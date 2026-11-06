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
