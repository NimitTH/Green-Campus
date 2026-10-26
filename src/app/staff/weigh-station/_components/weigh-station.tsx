"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Button, Card, inputClassLg } from "@/components/ui";
import { GENERIC_ERROR_TH } from "@/lib/errors";
import { countdownTone } from "./countdown-tone";
import {
  issueWeighCode,
  searchParticipants,
  type IssueCodeResult,
  type StudentHit,
} from "@/app/actions/weigh-codes";

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
          className="rounded-card border-2 border-accent bg-accent-soft p-6 text-center text-ink shadow-card"
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
        <ul className="space-y-3">
          {students.map((s) => (
            <Card as="li" key={s.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-lg break-words">{s.name}</span>
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
      )}
    </div>
  );
}
