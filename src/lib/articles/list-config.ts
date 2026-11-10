import type { ListConfig } from "@/app/_components/list/list-params";
import { quoteOrValue, toIlikePattern } from "@/app/_components/list/search-escape";
import { ARTICLE_CATEGORY_LABEL_TH } from "./format";

// DESIGN-4 3 (/articles): the list config, shared by the query (public.ts) and the toolbar.

export const ARTICLE_LIST_CONFIG = {
  sorts: {
    date: { label: "วันที่", kind: "date", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
    category: { label: "ประเภท", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  filters: { category: { label: "ประเภท", options: { ...ARTICLE_CATEGORY_LABEL_TH } } },
  views: true,
} satisfies ListConfig;

/** The articles column behind each sort key. */
export const ARTICLE_SORT_COLUMN: Record<keyof typeof ARTICLE_LIST_CONFIG.sorts, string> = {
  date: "created_at",
  name: "title",
  category: "category",
};

// DESIGN-4 4.4 (/staff/articles): the staff list config; drafts are listed too.
export const STAFF_ARTICLE_CONFIG = {
  sorts: {
    date: { label: "วันที่", kind: "date", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
  },
  defaultSort: "date",
  filters: { category: { label: "ประเภท", options: { ...ARTICLE_CATEGORY_LABEL_TH } } },
} satisfies ListConfig;

/** The articles column behind each staff sort key. */
export const STAFF_ARTICLE_SORT_COLUMN: Record<keyof typeof STAFF_ARTICLE_CONFIG.sorts, string> = {
  date: "updated_at", // each row shows "แก้ไขล่าสุด" (review M2)
  name: "title",
};

/** The `.or()` filter for the staff search text: the title only, matched literally. */
export function staffArticleSearchFilter(q: string): string {
  return `title.ilike.${quoteOrValue(toIlikePattern(q))}`;
}
