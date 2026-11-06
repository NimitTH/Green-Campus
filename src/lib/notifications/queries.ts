import { pageSizeOf, type ListConfig, type ListState } from "@/app/_components/list/list-params";
import { quoteOrValue, toIlikePattern } from "@/app/_components/list/search-escape";
import type { NotificationRow } from "@/app/_components/notification-list";
import { createServerClient } from "@/lib/supabase/server";
import { NOTIFICATION_SORT_COLUMN, typePrefix } from "./list-config";

/**
 * One page of the caller's notifications (their session, so RLS limits it to their own rows). Optional title/body
 * search, a type-prefix filter, sorted by date or title then id. A page past the end returns no items with the real
 * total, so the page can ask again for the last page. Throws on failure.
 */
export async function listNotificationsPage(
  state: Pick<ListState, "q" | "sort" | "dir" | "filters" | "page">,
  config: ListConfig,
): Promise<{ items: NotificationRow[]; total: number }> {
  const supabase = await createServerClient();
  const size = pageSizeOf(config);
  const pattern = state.q ? quoteOrValue(toIlikePattern(state.q)) : null;
  const prefix = typePrefix(state.filters.type);
  const filtered = <T extends { or(filter: string): T; like(column: string, pattern: string): T }>(query: T): T => {
    let out = query;
    if (pattern) out = out.or(`title.ilike.${pattern},body.ilike.${pattern}`);
    if (prefix) out = out.like("type", prefix);
    return out;
  };
  const column = Object.hasOwn(NOTIFICATION_SORT_COLUMN, state.sort) ? NOTIFICATION_SORT_COLUMN[state.sort as keyof typeof NOTIFICATION_SORT_COLUMN] : "created_at";
  const ascending = state.dir === "asc";
  const page = Math.max(1, Math.trunc(state.page) || 1);
  const { data, error, count } = await filtered(
    supabase.from("notifications").select("id, title, body, link, read_at, created_at", { count: "exact" }),
  )
    .order(column, { ascending, nullsFirst: false })
    .order("id", { ascending })
    .range((page - 1) * size, page * size - 1);

  if (error?.code === "PGRST103") {
    const head = await filtered(supabase.from("notifications").select("id", { count: "exact", head: true }));
    if (head.error || head.count === null) throw new Error(`listNotificationsPage: ${head.error?.message}`);
    return { items: [], total: head.count };
  }
  if (error) throw new Error(`listNotificationsPage: ${error.message}`);
  const items = (data ?? []) as NotificationRow[];
  return { items, total: count ?? items.length };
}
