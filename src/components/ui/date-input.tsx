"use client";

import { useEffect, useId, useRef, useState } from "react";
import { utcToBangkokLocal } from "@/lib/datetime";
import { BE_OFFSET, THAI_MONTHS_LONG, formatThaiDate, parseThaiDate } from "@/lib/thai-date";
import { inputClass } from "./field";

// DESIGN-4 5.4. The visible field is text in dd/mm/BE; a hidden input posts the Gregorian value the server has
// always read ("YYYY-MM-DD", or "YYYY-MM-DDTHH:mm" Bangkok wall time for DateTimeInput). An invalid or out of range
// text posts an empty value. A form that resets must key the component (the <Activity> rule in HANDOFF).

const DATE_ERROR = "วันที่ไม่ถูกต้อง (วว/ดด/ปปปป พ.ศ.)";
const TIME_ERROR = "เวลาไม่ถูกต้อง (ชช:นน 24 ชั่วโมง)";
const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${pad(m + 1)}-${pad(d)}`;

function split(value: string): [number, number, number] {
  return [Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))];
}

/** "08:05" / "8:05" -> "08:05"; null when not a 24h time. */
export function parseThaiTime(text: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [h, mi] = [Number(m[1]), Number(m[2])];
  return h > 23 || mi > 59 ? null : `${pad(h)}:${m[2]}`;
}

/** Move an ISO day by days or by months (a month move keeps the day, clamped to the month's last day). */
export function moveDay(value: string, days: number, months = 0): string {
  const [y, m, d] = split(value);
  if (months !== 0) {
    const target = new Date(Date.UTC(y, m + months, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return iso(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last));
  }
  const t = new Date(Date.UTC(y, m, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/** Weeks (Sunday first) of a month: ISO day strings, "" for the blanks around it. */
export function calendarGrid(year: number, month: number): string[][] {
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: string[] = [];
  for (let i = 0; i < lead; i++) cells.push("");
  for (let d = 1; d <= last; d++) cells.push(iso(year, month, d));
  while (cells.length % 7 !== 0) cells.push("");
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Pure digits get the separator inserted while typing; text that already has one is kept as typed. */
function autoFormat(raw: string, deleting: boolean, sep: "/" | ":"): string {
  const cleaned = raw.replace(sep === "/" ? /[^\d/]/g : /[^\d:]/g, "");
  if (cleaned.includes(sep)) return cleaned.slice(0, sep === "/" ? 10 : 5);
  const parts = sep === "/" ? [cleaned.slice(0, 2), cleaned.slice(2, 4), cleaned.slice(4, 8)] : [cleaned.slice(0, 2), cleaned.slice(2, 4)];
  const out = parts.filter(Boolean).join(sep);
  const atBoundary = sep === "/" ? cleaned.length === 2 || cleaned.length === 4 : cleaned.length === 2;
  return atBoundary && !deleting ? `${out}${sep}` : out;
}

const isDeleting = (e: React.ChangeEvent<HTMLInputElement>) => (e.nativeEvent as InputEvent).inputType?.startsWith("delete") ?? false;

function inRange(value: string, min?: string, max?: string): boolean {
  return (!min || value >= min) && (!max || value <= max);
}

const iconButton =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-input border border-rule-strong bg-surface text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type DateFieldProps = {
  id: string;
  initialIso: string;
  required?: boolean;
  min?: string;
  max?: string;
  errorId: string;
  describedBy?: string;
  onChange: (iso: string, invalid: boolean) => void;
};

/** The text field, the calendar button and the popover. Reports its ISO value ("" when empty or invalid) upward. */
function DateField({ id, initialIso, required, min, max, errorId, describedBy, onChange }: DateFieldProps) {
  const [text, setText] = useState(formatThaiDate(initialIso));
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState(initialIso);
  const [view, setView] = useState<[number, number]>([0, 0]);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLElement>());
  const dialogId = `${id}-calendar`;

  const parsed = text.trim() === "" ? null : parseThaiDate(text);
  const value = parsed && inRange(parsed, min, max) ? parsed : "";
  const invalid = text.trim() !== "" && value === "";
  const showError = invalid && (touched || text.length >= 10);

  useEffect(() => {
    onChange(value, invalid);
    // A native form (without noValidate) refuses to submit an invalid text.
    inputRef.current?.setCustomValidity(invalid ? DATE_ERROR : "");
  }, [value, invalid, onChange]);

  // Focus the roving day after it moves or the popover opens.
  useEffect(() => {
    if (open) cellRefs.current.get(focusDay)?.focus();
  }, [open, focusDay, view]);

  // A press outside closes the popover.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function openCalendar() {
    // The clock is read here (an event), never in render: prerendered pages must not depend on it.
    const today = utcToBangkokLocal(new Date().toISOString()).slice(0, 10);
    let start = value || today;
    if (min && start < min) start = min;
    if (max && start > max) start = max;
    const [y, m] = split(start);
    setView([y, m]);
    setFocusDay(start);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function pick(day: string) {
    if (!inRange(day, min, max)) return;
    setText(formatThaiDate(day));
    setTouched(true);
    close();
  }

  function goTo(day: string) {
    const [y, m] = split(day);
    setView([y, m]);
    setFocusDay(day);
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [-7, 0],
      ArrowDown: [7, 0],
      PageUp: [0, -1],
      PageDown: [0, 1],
    };
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(focusDay);
    } else if (steps[e.key]) {
      e.preventDefault();
      goTo(moveDay(focusDay, steps[e.key][0], steps[e.key][1]));
    }
  }

  const [vy, vm] = view;
  const monthLabel = `${THAI_MONTHS_LONG[vm]} ${vy + BE_OFFSET}`;
  const describedIds = [showError ? errorId : "", describedBy ?? ""].filter(Boolean).join(" ") || undefined;

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="วว/ดด/ปปปป"
          required={required}
          value={text}
          aria-invalid={showError ? true : undefined}
          aria-describedby={describedIds}
          onChange={(e) => setText(autoFormat(e.target.value, isDeleting(e), "/"))}
          onBlur={() => setTouched(true)}
          className={inputClass}
        />
        <button
          ref={buttonRef}
          type="button"
          aria-label="เลือกวันที่จากปฏิทิน"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          className={iconButton}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
      </div>
      {showError ? (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {DATE_ERROR}
        </p>
      ) : null}
      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label="เลือกวันที่"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-rule bg-surface p-3 shadow-sheet"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" onClick={() => goTo(moveDay(focusDay, 0, -1))} className={iconButton}>
              <span className="sr-only">เดือนก่อน</span>
              <span aria-hidden="true">‹</span>
            </button>
            <div aria-live="polite" className="font-display text-base font-semibold">
              {monthLabel}
            </div>
            <button type="button" onClick={() => goTo(moveDay(focusDay, 0, 1))} className={iconButton}>
              <span className="sr-only">เดือนถัดไป</span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <table role="grid" aria-label={monthLabel} onKeyDown={onGridKeyDown} className="w-full table-fixed text-center text-sm">
            <thead>
              <tr>
                {WEEKDAYS.map((w) => (
                  <th key={w} scope="col" className="py-1 text-xs font-medium text-muted">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarGrid(vy, vm).map((week, i) => (
                <tr key={i}>
                  {week.map((day, j) => {
                    if (day === "") return <td key={j} />;
                    const enabled = inRange(day, min, max);
                    return (
                      <td
                        key={j}
                        ref={(el) => {
                          if (el) cellRefs.current.set(day, el);
                          else cellRefs.current.delete(day);
                        }}
                        role="gridcell"
                        tabIndex={day === focusDay ? 0 : -1}
                        aria-selected={day === value}
                        aria-disabled={enabled ? undefined : true}
                        aria-label={`${Number(day.slice(8))} ${THAI_MONTHS_LONG[vm]} ${vy + BE_OFFSET}`}
                        onClick={() => pick(day)}
                        className={[
                          "h-10 rounded-input p-0 font-mono focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                          day === value ? "bg-accent text-white" : "hover:bg-accent-soft",
                          enabled ? "cursor-pointer" : "cursor-not-allowed opacity-40",
                        ].join(" ")}
                      >
                        {Number(day.slice(8))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function DateInput({
  name,
  id,
  defaultValue = "",
  required,
  min,
  max,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  min?: string;
  max?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const [value, setValue] = useState(formatThaiDate(defaultValue) ? defaultValue : "");
  return (
    <>
      <DateField id={fid} initialIso={defaultValue} required={required} min={min} max={max} errorId={`${fid}-error`} onChange={(v) => setValue(v)} />
      <input type="hidden" name={name} value={value} />
    </>
  );
}

export function DateTimeInput({
  name,
  id,
  defaultValue = "",
  required,
  error,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  /** A server-side message for this field, linked with aria-describedby. */
  error?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const [datePart, timePart = ""] = defaultValue.split("T");
  const [date, setDate] = useState(formatThaiDate(datePart) ? datePart : "");
  const [dateInvalid, setDateInvalid] = useState(false);
  const [time, setTime] = useState(timePart.slice(0, 5));
  const [touched, setTouched] = useState(false);
  const timeRef = useRef<HTMLInputElement>(null);
  const timeIso = time.trim() === "" ? null : parseThaiTime(time);
  const timeInvalid = time.trim() !== "" && timeIso === null;
  const showTimeError = timeInvalid && (touched || time.length >= 5);
  const posted = date && timeIso ? `${date}T${timeIso}` : "";
  const showServerError = Boolean(error) && !dateInvalid && !showTimeError;
  const errorId = `${fid}-error`;

  useEffect(() => {
    timeRef.current?.setCustomValidity(timeInvalid ? TIME_ERROR : "");
  }, [timeInvalid]);

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-2">
        <DateField
          id={fid}
          initialIso={datePart}
          required={required}
          errorId={`${fid}-date-error`}
          describedBy={showServerError ? errorId : undefined}
          onChange={(v, invalid) => {
            setDate(v);
            setDateInvalid(invalid);
          }}
        />
        <input
          ref={timeRef}
          id={`${fid}-time`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="เวลา"
          placeholder="ชช:นน"
          required={required}
          value={time}
          aria-invalid={showTimeError ? true : undefined}
          aria-describedby={showTimeError ? `${fid}-time-error` : showServerError ? errorId : undefined}
          onChange={(e) => setTime(autoFormat(e.target.value, isDeleting(e), ":"))}
          onBlur={() => setTouched(true)}
          className={inputClass}
        />
      </div>
      {showTimeError ? (
        <p id={`${fid}-time-error`} className="mt-1 text-sm text-danger">
          {TIME_ERROR}
        </p>
      ) : null}
      {showServerError ? (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <input type="hidden" name={name} value={posted} />
    </div>
  );
}
