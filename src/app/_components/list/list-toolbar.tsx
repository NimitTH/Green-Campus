"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { inputClass } from "@/components/ui";
import { listHref, parseListParams, searchParamsRecord, type ListSort } from "./list-params";
import { ViewToggle } from "./view-toggle";

const ROW = "flex flex-wrap items-center gap-2";
const SEARCH = "min-w-0 flex-[1_1_100%] sm:flex-[1_1_12rem]";
const SELECT = `${inputClass} w-auto pr-8`;

// DESIGN-3 5.3: search, sort and the card/list toggle of a public list. It reads the current values from the
// URL (useSearchParams), so the page renders it inside its own <Suspense> and keeps its heading in the static
// shell. Without JavaScript the form still works as a plain GET (the submit button is sr-only until focused);
// with JavaScript a search pushes the canonical URL and a sort change replaces it. Both go back to page 1.
export function ListToolbar({ base, placeholder }: { base: string; placeholder: string }) {
  const router = useRouter();
  const params = parseListParams(searchParamsRecord(useSearchParams()));
  const uid = useId();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = parseListParams({ q: String(new FormData(e.currentTarget).get("q") ?? "") }).q;
    router.push(listHref(base, params, { q }));
  }

  function onSort(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(listHref(base, params, { sort: e.target.value as ListSort }), { scroll: false });
  }

  return (
    <form method="get" role="search" action={base} onSubmit={onSubmit} className={`${ROW} mb-6`}>
      <label htmlFor={`${uid}-q`} className="sr-only">
        {placeholder}
      </label>
      <input
        key={params.q}
        id={`${uid}-q`}
        type="search"
        name="q"
        defaultValue={params.q}
        placeholder={placeholder}
        maxLength={100}
        className={`${inputClass} ${SEARCH}`}
      />
      {params.view !== "card" ? <input type="hidden" name="view" value={params.view} /> : null}
      <div className="flex items-center gap-2">
        <label htmlFor={`${uid}-sort`} className="text-sm text-muted">
          เรียง
        </label>
        <select key={params.sort} id={`${uid}-sort`} name="sort" defaultValue={params.sort} onChange={onSort} className={SELECT}>
          <option value="new">ใหม่ → เก่า</option>
          <option value="old">เก่า → ใหม่</option>
        </select>
      </div>
      <button
        type="submit"
        className="sr-only rounded-input border border-rule-strong bg-surface px-4 text-sm font-medium text-ink focus:not-sr-only focus:inline-flex focus:min-h-11 focus:items-center focus:outline-2 focus:outline-offset-2 focus:outline-accent"
      >
        ค้นหา
      </button>
      <div className="ml-auto">
        <ViewToggle base={base} params={params} />
      </div>
    </form>
  );
}

/** The toolbar's size with no controls, shown until the URL values are known. */
export function ListToolbarSkeleton() {
  return (
    <div aria-hidden="true" className={`${ROW} mb-6`}>
      <div className={`h-11 rounded-input border border-rule bg-surface ${SEARCH}`} />
      <div className="h-11 w-44 rounded-input bg-paper-2" />
      <div className="ml-auto h-11 w-[87px] rounded-input bg-paper-2" />
    </div>
  );
}
