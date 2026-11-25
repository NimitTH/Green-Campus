import type { WasteRate } from "@/lib/activities/waste-rates";

const th = "px-2 py-2 text-left text-xs font-medium text-muted sm:px-3";
const thNum = "px-2 py-2 text-right text-xs font-medium text-muted sm:px-3";
const td = "px-2 py-2 break-words sm:px-3";
const tdNum = "px-2 py-2 text-right font-mono sm:px-3";

/** Round 6 (old-site features 1): what each kilogram of each waste group earns, before the student joins. */
export function WasteRateCard({ rates }: { rates: WasteRate[] }) {
  return (
    <table className="mt-4 w-full table-fixed border-collapse text-sm">
      <caption className="mb-2 text-left font-display font-semibold text-ink">อัตราแต้มและ carbon ต่อ กก.</caption>
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className={th}>
            กลุ่ม
          </th>
          <th scope="col" className={thNum}>
            แต้ม/กก.
          </th>
          <th scope="col" className={thNum}>
            carbon กก. CO₂e/กก.
          </th>
        </tr>
      </thead>
      <tbody>
        {rates.map((r) => (
          <tr key={r.code} className="border-b border-rule last:border-0">
            <th scope="row" className={`${td} text-left font-normal`}>
              {r.name}
            </th>
            <td className={tdNum}>{r.pointsPerKg.toLocaleString("th-TH")}</td>
            <td className={tdNum}>{r.carbonKgPerKg.toLocaleString("th-TH", { maximumFractionDigits: 3 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
