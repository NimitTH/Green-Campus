"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { inputClass } from "@/components/ui";
import { FilterSelect, TOOLBAR_SELECT } from "./filter-select";
import { filterDefault, listHref, normalizeQ, parseListParams, searchParamsRecord, type ListConfig, type ListPatch } from "./list-params";
import { SortDirection } from "./sort-direction";
import { ViewToggle } from "./view-toggle";

const ROW = "flex flex-wrap items-center gap-2";
const SEARCH = "min-w-0 flex-1";

// DESIGN-4 2.3 (layout B): row 1 is the search box (+ the card/list toggle when the config has views); row 2 is
// "เรียงตาม" + the sort select + the direction link, then one labelled select per filter, wrapping on narrow screens.
// It reads the current values from the URL (useSearchParams), so the page renders it inside its own <Suspense> and
// keeps its heading in the static shell. Without JavaScript the form still works as a plain GET (the selects carry
// their names, hidden inputs carry dir and view, the submit button is sr-only until focused); with JavaScript a
// search pushes the canonical URL and a select change replaces it. All but a view change go back to page 1.
export function ListToolbar({ base, config, placeholder }: { base: string; config: ListConfig; placeholder: string }) {
  const router = useRouter();
  const state = parseListParams(config, searchParamsRecord(config, useSearchParams()));
  const uid = useId();

  function go(patch: ListPatch) {
    router.replace(listHref(base, config, state, patch), { scroll: false });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = normalizeQ(String(new FormData(e.currentTarget).get("q") ?? ""));
    router.push(listHref(base, config, state, { q }));
  }

  const filters = Object.entries(config.filters ?? {});
  return (
    <form method="get" role="search" action={base} onSubmit={onSubmit} className="mb-6 flex flex-col gap-3">
      <div className={ROW}>
        <label htmlFor={`${uid}-q`} className="sr-only">
          {placeholder}
        </label>
        <input
          key={state.q}
          id={`${uid}-q`}
          type="search"
          name="q"
          defaultValue={state.q}
          placeholder={placeholder}
          maxLength={100}
          className={`${inputClass} ${SEARCH}`}
        />
        <button
          type="submit"
          className="sr-only rounded-input border border-rule-strong bg-surface px-4 text-sm font-medium text-ink focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        >
          ค้นหา
        </button>
        {config.views ? <ViewToggle base={base} config={config} state={state} /> : null}
      </div>
      <div className={ROW}>
        {state.dir !== config.sorts[state.sort].defaultDir ? <input type="hidden" name="dir" value={state.dir} /> : null}
        {state.view !== "card" ? <input type="hidden" name="view" value={state.view} /> : null}
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor={`${uid}-sort`} className="shrink-0 text-sm text-muted">
            เรียงตาม
          </label>
          <select key={state.sort} id={`${uid}-sort`} name="sort" defaultValue={state.sort} onChange={(e) => go({ sort: e.target.value })} className={TOOLBAR_SELECT}>
            {Object.entries(config.sorts).map(([key, spec]) => (
              <option key={key} value={key}>
                {spec.label}
              </option>
            ))}
          </select>
        </div>
        <SortDirection base={base} config={config} state={state} />
        {filters.map(([name, spec]) => (
          <FilterSelect
            key={name}
            id={`${uid}-f-${name}`}
            name={name}
            spec={spec}
            value={state.filters[name] ?? filterDefault(spec)}
            onChange={(v) => go({ filters: { [name]: v } })}
          />
        ))}
      </div>
    </form>
  );
}

/** The toolbar's size with no controls, shown until the URL values are known. */
export function ListToolbarSkeleton({ views = true, filters = 0 }: { views?: boolean; filters?: number }) {
  return (
    <div aria-hidden="true" className="mb-6 flex flex-col gap-3">
      <div className={ROW}>
        <div className={`h-11 rounded-input border border-rule bg-surface ${SEARCH}`} />
        {views ? <div className="h-11 w-[87px] rounded-input bg-paper-2" /> : null}
      </div>
      <div className={ROW}>
        <div className="h-11 w-36 rounded-input bg-paper-2" />
        <div className="h-11 w-28 rounded-input bg-paper-2" />
        {Array.from({ length: filters }, (_, i) => (
          <div key={i} className="h-11 w-36 rounded-input bg-paper-2" />
        ))}
      </div>
    </div>
  );
}
