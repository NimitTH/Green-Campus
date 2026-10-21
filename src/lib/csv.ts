// CSV for Excel (Task 16, R104; spec 10.1): UTF-8 with BOM, CRLF line ends (also after the last line).
// String cells are guarded against spreadsheet formula injection and quoted per RFC 4180.

const BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | null): string {
  if (value === null) return "";
  // Numbers are written as-is: a negative number is data, not a formula.
  if (typeof value === "number") return String(value);
  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(guarded) || guarded !== guarded.trim()) return `"${guarded.replaceAll('"', '""')}"`;
  return guarded;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return BOM + rows.map((row) => row.map(cell).join(",") + "\r\n").join("");
}
