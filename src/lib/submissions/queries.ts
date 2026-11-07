import "server-only";
import { pageSizeOf, type ListState } from "@/app/_components/list/list-params";
import { fetchPage } from "@/app/_components/list/paging";
import { toIlikePattern } from "@/app/_components/list/search-escape";
import { activityCoverUrl } from "@/lib/activities/cover";
import { createServerClient } from "@/lib/supabase/server";
import { MY_SUBMISSION_CONFIG, MY_SUBMISSION_SORT_COLUMN } from "./list-config";

export type MySubmission = {
  id: string;
  activityId: string;
  activityTitle: string;
  activityType: string;
  coverUrl: string | null;
  status: string;
  points: number | null;
  grams: number | null;
  trees: number | null;
  rejectReason: string | null;
  createdAt: string;
  /** Per-category weights for waste ("ขวด 1.5 กก."), the tree count, or "เข้าร่วม" (as the page always showed). */
  amountText: string;
  /** CO2e of an approved submission, from its earn ledger row. */
  carbonKg: number | null;
};

type ViewRow = {
  id: string;
  activity_id: string;
  activity_title: string;
  activity_type: string;
  activity_cover_path: string | null;
  status: string;
  points: number | null;
  grams: number | string | null;
  trees: number | string | null;
  reject_reason: string | null;
  created_at: string;
};

type ItemRow = {
  submission_id: string;
  quantity: number;
  waste_categories: { name: string } | { name: string }[] | null;
};

const COLUMNS = "id, activity_id, activity_title, activity_type, activity_cover_path, status, points, grams, trees, reject_reason, created_at";
const kgFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });

function categoryName(i: ItemRow): string {
  const c = Array.isArray(i.waste_categories) ? i.waste_categories[0] : i.waste_categories;
  return c?.name ?? "-";
}

function amountText(type: string, items: ItemRow[]): string {
  if (type === "waste") {
    return items
      .map((i) => ({ name: categoryName(i), grams: i.quantity }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((i) => `${i.name} ${kgFormat.format(i.grams / 1000)} กก.`)
      .join(", ");
  }
  if (type === "trees") return `${items.reduce((s, i) => s + i.quantity, 0).toLocaleString("th-TH")} ต้น`;
  return "เข้าร่วม";
}

const toNumber = (v: number | string | null): number | null => (v === null ? null : Number(v));

/**
 * One page of the signed-in student's submissions, from my_submission_list (their session; the view is
 * security_invoker). Optional search on the activity title (literal), sorted by MY_SUBMISSION_CONFIG then id, nulls
 * last. A page past the end returns no items with the real total, so the page can ask again for the last page.
 * Throws on failure.
 */
export async function listMySubmissionsPage(
  studentId: string,
  state: Pick<ListState, "q" | "sort" | "dir" | "page">,
): Promise<{ items: MySubmission[]; total: number }> {
  const supabase = await createServerClient();
  const pattern = state.q ? toIlikePattern(state.q) : null;
  const filtered = <T extends { ilike(column: string, pattern: string): T }>(query: T): T => (pattern ? query.ilike("activity_title", pattern) : query);
  const column = Object.hasOwn(MY_SUBMISSION_SORT_COLUMN, state.sort)
    ? MY_SUBMISSION_SORT_COLUMN[state.sort as keyof typeof MY_SUBMISSION_SORT_COLUMN]
    : "created_at";
  const ascending = state.dir === "asc";
  const { items: rows, total } = await fetchPage<ViewRow>("listMySubmissionsPage", {
    page: state.page,
    size: pageSizeOf(MY_SUBMISSION_CONFIG),
    run: (from, to) =>
      filtered(supabase.from("my_submission_list").select(COLUMNS, { count: "exact" }).eq("student_id", studentId))
        .order(column, { ascending, nullsFirst: false })
        .order("id", { ascending })
        .range(from, to),
    head: () => filtered(supabase.from("my_submission_list").select("id", { count: "exact", head: true }).eq("student_id", studentId)),
  });
  const ids = rows.map((r) => r.id);

  const itemsBy = new Map<string, ItemRow[]>();
  const carbonBy = new Map<string, number>();
  if (ids.length > 0) {
    const [items, ledger] = await Promise.all([
      supabase.from("submission_items").select("submission_id, quantity, waste_categories(name)").in("submission_id", ids),
      supabase.from("ledger_entries").select("ref_submission_id, carbon_kg").eq("kind", "earn").in("ref_submission_id", ids),
    ]);
    if (items.error) throw new Error(`listMySubmissionsPage: ${items.error.message}`);
    if (ledger.error) throw new Error(`listMySubmissionsPage: ${ledger.error.message}`);
    for (const i of (items.data ?? []) as unknown as ItemRow[]) itemsBy.set(i.submission_id, [...(itemsBy.get(i.submission_id) ?? []), i]);
    for (const e of (ledger.data ?? []) as { ref_submission_id: string; carbon_kg: number | string }[]) carbonBy.set(e.ref_submission_id, Number(e.carbon_kg));
  }

  const result: MySubmission[] = rows.map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    activityTitle: r.activity_title,
    activityType: r.activity_type,
    coverUrl: activityCoverUrl(r.activity_cover_path),
    status: r.status,
    points: r.points,
    grams: toNumber(r.grams),
    trees: toNumber(r.trees),
    rejectReason: r.reject_reason,
    createdAt: r.created_at,
    amountText: amountText(r.activity_type, itemsBy.get(r.id) ?? []),
    carbonKg: carbonBy.get(r.id) ?? null,
  }));
  return { items: result, total };
}
