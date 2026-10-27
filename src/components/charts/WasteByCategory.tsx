"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

export type WasteDatum = { name: string; kg: number };

const kgFormat = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 3 });

// Literal class names so Tailwind generates them; bars take their colour by order (DESIGN §4).
const BAR_FILL = ["fill-chart-1", "fill-chart-2", "fill-chart-3", "fill-chart-4"];

/** Bar chart of approved waste weight (kg) per category, with a text table for screen readers. */
export function WasteByCategory({ data }: { data: WasteDatum[] }) {
  return (
    <div data-testid="waste-chart">
      <div aria-hidden="true" className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 256 }}>
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis dataKey="name" interval={0} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--rule)" />
            <YAxis width={36} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--rule)" />
            <Bar dataKey="kg" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.name} className={BAR_FILL[i % BAR_FILL.length]} />
              ))}
              <LabelList
                dataKey="kg"
                position="top"
                formatter={(v) => kgFormat.format(Number(v))}
                fontSize={12}
                fill="var(--ink)"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table data-testid="waste-table" className="sr-only">
        <caption>น้ำหนักขยะที่อนุมัติแล้ว (กก.) แยกตามกลุ่ม</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.name}>
              <th scope="row">{d.name}</th>
              <td>{kgFormat.format(d.kg)} กก.</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
