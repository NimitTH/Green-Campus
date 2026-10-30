import { createAnonClient } from "@/lib/supabase/anon";

// DESIGN-3 5.1/7.3: display names of teachers/admins (article and activity bylines) through the public
// staff_names() function. Cookie-free (anon client), so it can run inside cached (use cache) scopes; callers pass
// every id of one page at once. Never throws: a failure is logged and yields an empty map ("โดย -").

const MAX_IDS = 100; // staff_names() evaluates at most 100 ids

export async function getStaffNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, MAX_IDS);
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  try {
    const { data, error } = await createAnonClient().rpc("staff_names", { p_ids: unique });
    if (error) {
      console.error("getStaffNames failed");
      return names;
    }
    for (const row of (data ?? []) as { id: string; name: string | null }[]) {
      if (row.name) names.set(row.id, row.name);
    }
  } catch {
    console.error("getStaffNames failed");
  }
  return names;
}
