"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { paginateRows, sortRows } from "@/app/_components/list/client-list";
import { directionAriaLabel, directionLabel, PAGE_SIZE, type SortDir } from "@/app/_components/list/list-params";
import { pageWindow } from "@/app/_components/list/pagination";
import { Button, Card, inputClass, inputClassLg } from "@/components/ui";
import { formatBangkok } from "@/lib/datetime";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { countdownTone } from "./countdown-tone";
import {
  issueWeighCode,
  searchParticipants,
  type IssueCodeResult,
  type StudentHit,
} from "@/app/actions/weigh-codes";

const PAGE_BTN =
  "inline-flex size-11 items-center justify-center rounded-input text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:text-muted disabled:opacity-55";

type Activity = { id: string; title: string };

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Live countdown to `expiresAt`; shows "หมดอายุแล้ว" at 0 and then calls onExpired once. */
function Countdown({
  expiresAt,
  clockOffsetMs,
  onExpired,
}: {
  expiresAt: string;
  clockOffsetMs: number;
  onExpired: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  });
  useEffect(() => {
    let fired = false;
    const tick = () => {
      const t = Date.now() + clockOffsetMs;
      setNow(t);
      if (!fired && Date.parse(expiresAt) - t <= 0) {
        fired = true;
        expired.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, clockOffsetMs]);

  if (now === null) return <p className="text-lg">&nbsp;</p>;
  const remaining = Date.parse(expiresAt) - now;
  if (remaining <= 0) {
    return (
      <p role="status" className="text-xl font-semibold text-danger">
        หมดอายุแล้ว
      </p>
    );
  }
  return (
    <p role="timer" className={`text-xl ${countdownTone(remaining) === "warn" ? "text-warn" : "text-ink"}`}>
      หมดอายุใน <span className="font-mono font-semibold">{formatRemaining(remaining)}</span>
    </p>
  );
}

// clockOffsetMs = database time minus this device's clock when the code was received.
type Issued = { student: StudentHit; code: string; expiresAt: string; clockOffsetMs: number };

export function WeighStation({ activities }: { activities: Activity[] }) {
  const [activityId, setActivityId] = useState(activities[0].id);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentHit[]>([]);
  // Search key (activity + text) of the results currently shown; differs while a search is in flight.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [sort, setSort] = useState<"joined" | "name">("joined");
  const [dir, setDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [searchError, setSearchError] = useState<string | undefined>();
  const [issued, setIssued] = useState<Issued | null>(null);
  const [issueError, setIssueError] = useState<string | undefined>();
  const [issuingId, setIssuingId] = useState<string | null>(null);
  // Student whose code ran out (the code itself is cleared, so a stale code is never shown).
  const [expiredFor, setExpiredFor] = useState<string | null>(null);
  const uid = useId();
  // Cache Components keep this page alive (hidden <Activity>) after navigating away: an issued code and
  // its countdown belong to that visit, so drop them when the page is hidden (Preserving UI state docs).
  useLayoutEffect(
    () => () => {
      setIssued(null);
      setIssueError(undefined);
      setExpiredFor(null);
    },
    [],
  );
  const [, startTransition] = useTransition();
  const requestId = useRef(0);

  // Search participants whenever the activity or the text changes (debounced).
  useEffect(() => {
    const id = ++requestId.current;
    const key = `${activityId}|${query}`;
    const timer = setTimeout(() => {
      searchParticipants(activityId, query)
        .then((result) => {
          if (id !== requestId.current) return;
          setStudents(result.students);
          setPage(1);
          setSearchError(result.error);
          setLoadedKey(key);
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setStudents([]);
          setSearchError(GENERIC_ERROR_TH);
          setLoadedKey(key);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [activityId, query]);

  const sortKind = sort === "name" ? "text" : "date";
  const sorted = sort === "name" ? sortRows(students, (s) => s.name, "text", dir) : sortRows(students, (s) => s.joinedAt, "date", dir);
  const paged = paginateRows(sorted, page, PAGE_SIZE);
  const searching = loadedKey !== `${activityId}|${query}`;

  function issue(student: StudentHit) {
    setExpiredFor(null);
    setIssueError(undefined);
    setIssuingId(student.id);
    startTransition(async () => {
      try {
        const result: IssueCodeResult = await issueWeighCode(activityId, student.id);
        if (result.ok) {
          setIssued({
            student,
            code: result.code,
            expiresAt: result.expiresAt,
            clockOffsetMs: Date.parse(result.serverNow) - Date.now(),
          });
        } else {
          setIssued(null);
          setIssueError(result.error);
        }
      } catch {
        setIssued(null);
        setIssueError(GENERIC_ERROR_TH);
      } finally {
        setIssuingId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor={`${uid}-activity`} className="mb-1 block font-medium text-ink">
          กิจกรรม
        </label>
        <select
          id={`${uid}-activity`}
          value={activityId}
          onChange={(e) => {
            // a change event for the already-selected activity must not clear its results: the search
            // effect only re-runs when the id changes, so the list would stay empty
            if (e.target.value === activityId) return;
            setActivityId(e.target.value);
            setStudents([]);
            setPage(1);
            setSearchError(undefined);
            setIssued(null);
            setIssueError(undefined);
          }}
          className={inputClassLg}
        >
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${uid}-search`} className="mb-1 block font-medium text-ink">
          ค้นหานักเรียน
        </label>
        <input
          id={`${uid}-search`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์ชื่อนักเรียน"
          autoComplete="off"
          className={inputClassLg}
        />
      </div>

      {searchError ? (
        <p role="alert" className="text-danger">
          {searchError}
        </p>
      ) : null}
      {issueError ? (
        <p role="alert" className="rounded-input border border-danger p-3 font-medium text-danger">
          {issueError}
        </p>
      ) : null}

      {issued ? (
        // Hand-written, not Card: Card has no border variant, and stacking border-2 border-accent on Card's border-rule would be order-dependent.
        <section
          aria-label="รหัสจุดชั่ง"
          className="rounded-card border-2 border-accent bg-accent-soft p-6 text-center text-ink shadow-sheet"
        >
          <p className="mb-2 text-base">รหัสสำหรับ {issued.student.name}</p>
          <p
            data-testid="weigh-code"
            aria-label={`รหัส ${issued.code.split("").join(" ")}`}
            className="font-mono text-6xl font-bold tracking-[0.3em] text-ink sm:text-7xl"
          >
            {issued.code}
          </p>
          <div className="mt-3">
            <Countdown
              expiresAt={issued.expiresAt}
              clockOffsetMs={issued.clockOffsetMs}
              onExpired={() => {
                setExpiredFor(issued.student.name);
                setIssued(null);
              }}
            />
          </div>
        </section>
      ) : expiredFor ? (
        <p role="status" data-testid="weigh-code-expired" className="rounded-card border border-warn p-4 text-center text-warn">
          รหัสของ {expiredFor} หมดอายุแล้ว กดออกรหัสใหม่ได้
        </p>
      ) : null}

      {searching ? (
        <p role="status" className="text-muted">
          กำลังค้นหา...
        </p>
      ) : students.length === 0 ? (
        <p className="text-muted">ไม่พบนักเรียนที่เข้าร่วมกิจกรรมนี้</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${uid}-sort`} className="shrink-0 text-sm text-muted">
              เรียงตาม
            </label>
            <select
              id={`${uid}-sort`}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value === "name" ? "name" : "joined");
                setDir("asc");
                setPage(1);
              }}
              className={`${inputClass} w-auto min-w-0 max-w-full pr-8`}
            >
              <option value="joined">วันที่เข้าร่วม</option>
              <option value="name">ชื่อ</option>
            </select>
            <button
              type="button"
              data-testid="weigh-sort-dir"
              data-dir={dir}
              aria-label={directionAriaLabel(sortKind, dir)}
              onClick={() => {
                setDir(dir === "asc" ? "desc" : "asc");
                setPage(1);
              }}
              className="inline-flex min-h-11 shrink-0 items-center rounded-input border border-rule-strong bg-surface px-3 text-sm font-medium whitespace-nowrap text-ink hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {directionLabel(sortKind, dir)}
            </button>
          </div>
        <ul className="space-y-3">
          {paged.items.map((s) => (
            <Card as="li" key={s.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-lg break-words">{s.name}</span>
                <span className="block text-sm text-muted">เข้าร่วม {formatBangkok(s.joinedAt)}</span>
              </span>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => issue(s)}
                disabled={issuingId !== null}
                aria-label={`ออกรหัสให้ ${s.name}`}
                className="shrink-0"
              >
                {issuingId === s.id ? "กำลังออกรหัส..." : "ออกรหัส"}
              </Button>
            </Card>
          ))}
        </ul>
          {paged.lastPage > 1 ? (
            <nav aria-label="แบ่งหน้า" className="flex justify-center">
              <ul className="flex flex-wrap items-center justify-center gap-1">
                <li>
                  <button type="button" aria-label="หน้าก่อน" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)} className={PAGE_BTN}>
                    ‹
                  </button>
                </li>
                {pageWindow(paged.page, paged.lastPage).map((n, i) =>
                  n === "…" ? (
                    <li key={`gap-${i}`} aria-hidden="true" className="inline-flex size-11 items-center justify-center text-muted">
                      …
                    </li>
                  ) : (
                    <li key={n}>
                      <button
                        type="button"
                        aria-label={`หน้า ${n}`}
                        aria-current={n === paged.page ? "page" : undefined}
                        onClick={() => setPage(n)}
                        className={`${PAGE_BTN} ${n === paged.page ? "bg-accent text-on-accent" : "hover:bg-accent-soft"}`}
                      >
                        {n}
                      </button>
                    </li>
                  ),
                )}
                <li>
                  <button type="button" aria-label="หน้าถัดไป" disabled={paged.page >= paged.lastPage} onClick={() => setPage(paged.page + 1)} className={PAGE_BTN}>
                    ›
                  </button>
                </li>
              </ul>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
