import type { ListConfig } from "@/app/_components/list/list-params";
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
