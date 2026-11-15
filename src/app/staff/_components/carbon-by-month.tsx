"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

export type CarbonMonthDatum = { month: string; carbonKg: number };

const kgFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });
// `month` is a calendar date ("2026-11-01"); read it at UTC midnight so no zone shifts it into the previous month.
const shortMonth = new Intl.DateTimeFormat("th-TH", { month: "short", timeZone: "UTC" });
const longMonth = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });
const at = (month: string) => new Date(`${month.slice(0, 10)}T00:00:00Z`);

/** DESIGN-4 4.3 chart A: carbon saved per month (kg CO2e) as bars, with a text table for screen readers. */
export function CarbonByMonth({ data }: { data: CarbonMonthDatum[] }) {
  const rows = data.map((d) => ({ label: shortMonth.format(at(d.month)), carbonKg: d.carbonKg, month: d.month }));
  return (
    <div data-testid="carbon-chart">
      <div aria-hidden="true" className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 256 }}>
          {/* accessibilityLayer off: the svg would be a tab stop inside this aria-hidden box; the table below is the accessible copy */}
          <BarChart data={rows} accessibilityLayer={false} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis dataKey="label" interval={0} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--rule)" />
            <YAxis width={36} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--rule)" />
            <Bar dataKey="carbonKg" radius={[4, 4, 0, 0]} isAnimationActive={false} fill="var(--chart-1)">
              <LabelList
                dataKey="carbonKg"
                position="top"
                formatter={(v) => kgFormat.format(Number(v))}
                fontSize={12}
                fill="var(--ink)"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table data-testid="carbon-table" className="sr-only">
        <caption>carbon ที่ลดได้รายเดือน (กก. CO₂e)</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{longMonth.format(at(d.month))}</th>
              <td>{kgFormat.format(d.carbonKg)} กก. CO₂e</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
