"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GENERIC_ERROR_TH } from "@/lib/errors";
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

/** Live countdown to `expiresAt`; shows "หมดอายุแล้ว" at 0. */
function Countdown({ expiresAt, clockOffsetMs }: { expiresAt: string; clockOffsetMs: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() + clockOffsetMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, clockOffsetMs]);

  if (now === null) return <p className="text-lg">&nbsp;</p>;
  const remaining = Date.parse(expiresAt) - now;
  if (remaining <= 0) {
    return (
      <p role="status" className="text-xl font-semibold text-red-700">
        หมดอายุแล้ว
      </p>
    );
  }
  return (
    <p role="timer" className="text-xl">
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
        <label htmlFor="ws-activity" className="mb-1 block font-medium">
          กิจกรรม
        </label>
        <select
          id="ws-activity"
          value={activityId}
          onChange={(e) => {
            setActivityId(e.target.value);
            setStudents([]);
            setSearchError(undefined);
            setIssued(null);
            setIssueError(undefined);
          }}
          className="min-h-12 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-base dark:border-gray-700"
        >
          {activities.map((a) => (
            <option key={a.id} value={a.id} className="text-black">
              {a.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ws-search" className="mb-1 block font-medium">
          ค้นหานักเรียน
        </label>
        <input
          id="ws-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์ชื่อนักเรียน"
          autoComplete="off"
          className="min-h-12 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-base dark:border-gray-700"
        />
      </div>

      {searchError ? (
        <p role="alert" className="text-red-700">
          {searchError}
        </p>
      ) : null}
      {issueError ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {issueError}
        </p>
      ) : null}

      {issued ? (
        <section
          aria-label="รหัสจุดชั่ง"
          className="rounded-2xl border-2 border-green-600 bg-green-50 p-6 text-center dark:bg-green-950"
        >
          <p className="mb-2 text-base">รหัสสำหรับ {issued.student.name}</p>
          <p
            data-testid="weigh-code"
            aria-label={`รหัส ${issued.code.split("").join(" ")}`}
            className="font-mono text-6xl font-bold tracking-[0.3em] sm:text-7xl"
          >
            {issued.code}
          </p>
          <div className="mt-3">
            <Countdown expiresAt={issued.expiresAt} clockOffsetMs={issued.clockOffsetMs} />
          </div>
        </section>
      ) : null}

      {searching ? (
        <p role="status" className="text-gray-600 dark:text-gray-400">
          กำลังค้นหา...
        </p>
      ) : students.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">ไม่พบนักเรียนที่เข้าร่วมกิจกรรมนี้</p>
      ) : (
        <ul className="space-y-3">
          {students.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
            >
              <span className="min-w-0 text-lg break-words">{s.name}</span>
              <button
                type="button"
                onClick={() => issue(s)}
                disabled={issuingId !== null}
                aria-label={`ออกรหัสให้ ${s.name}`}
                className="min-h-14 shrink-0 rounded-xl bg-green-700 px-6 text-lg font-semibold text-white hover:bg-green-800 disabled:opacity-60"
              >
                {issuingId === s.id ? "กำลังออกรหัส..." : "ออกรหัส"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
