import type { ReactNode } from "react";

// DESIGN-4 5.3: loading placeholders shaped like the pages they stand in for. Each is a <Suspense> fallback.
// They carry no per-user data and read nothing dynamic, so they are safe in the prerendered shell. The list
// skeleton cannot know the `view` from the URL while prerendering, so callers pass the page's default.

function Shell({ name, children, className = "space-y-4" }: { name: string; children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" data-skeleton={name} className={`motion-safe:animate-pulse ${className}`}>
      <p className="sr-only">กำลังโหลด...</p>
      {children}
    </div>
  );
}

const bar = (cls: string) => <div className={`rounded-input bg-paper-2 ${cls}`} />;

export function ListSkeleton({
  view = "card",
  rows = 6,
  toolbar = true,
  gridClassName = "gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  view?: "card" | "list";
  rows?: number;
  toolbar?: boolean;
  gridClassName?: string;
}) {
  const items = Array.from({ length: rows }, (_, i) => i);
  return (
    <Shell name="list">
      {toolbar ? (
        <div data-skeleton-toolbar className="flex flex-wrap gap-2">
          {bar("h-11 min-w-0 flex-1 basis-48")}
          {bar("h-11 w-32")}
          {bar("h-11 w-24")}
        </div>
      ) : null}
      {view === "list" ? (
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i} data-skeleton-row className="flex items-center gap-3 rounded-card bg-paper-2 p-3">
              <div className="h-16 w-24 shrink-0 rounded-input bg-paper" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded-input bg-paper" />
                <div className="h-3 w-1/3 rounded-input bg-paper" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${gridClassName}`}>
          {items.map((i) => (
            <div key={i} data-skeleton-row className="space-y-3 rounded-card bg-paper-2 p-3">
              <div className="aspect-[4/3] w-full rounded-input bg-paper" />
              <div className="h-4 w-3/4 rounded-input bg-paper" />
              <div className="h-3 w-1/2 rounded-input bg-paper" />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function DetailSkeleton() {
  return (
    <Shell name="detail">
      <div className="h-48 rounded-card bg-paper-2 sm:h-64" />
      {bar("h-8 w-2/3")}
      <div className="space-y-2">
        {bar("h-4 w-full")}
        {bar("h-4 w-full")}
        {bar("h-4 w-5/6")}
        {bar("h-4 w-2/3")}
      </div>
    </Shell>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Shell name="form">
      {bar("h-8 w-1/2")}
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} data-skeleton-field className="space-y-2">
          {bar("h-4 w-24")}
          {bar("h-11 w-full")}
        </div>
      ))}
      <div className="h-11 w-32 rounded-input bg-paper-2" />
    </Shell>
  );
}

export function DashboardSkeleton() {
  return (
    <Shell name="dashboard">
      <div className="flex items-center gap-3">
        <div className="size-[72px] shrink-0 rounded-full bg-paper-2" />
        <div className="flex-1 space-y-2">
          {bar("h-6 w-1/2")}
          {bar("h-4 w-1/3")}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-card bg-paper-2" />
        ))}
      </div>
      <div className="h-56 rounded-card bg-paper-2" />
    </Shell>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Shell name="table" className="space-y-2">
      <div className="h-10 rounded-input bg-paper-2" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} data-skeleton-row className="h-10 rounded-input bg-paper-2" />
      ))}
    </Shell>
  );
}
