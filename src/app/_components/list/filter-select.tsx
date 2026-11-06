import { inputClass } from "@/components/ui";
import { ALL, type FilterSpec } from "./list-params";

export const TOOLBAR_SELECT = `${inputClass} w-auto min-w-0 max-w-full pr-8`;

/**
 * DESIGN-4 2.3: one filter of the toolbar, a label and a select whose first option is "ทั้งหมด" (all). `name` is the
 * URL param, so the toolbar form also works as a plain GET without JavaScript.
 */
export function FilterSelect({
  id,
  name,
  spec,
  value,
  onChange,
}: {
  id: string;
  name: string;
  spec: FilterSpec;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-sm text-muted">
        {spec.label}
      </label>
      <select key={value} id={id} name={name} defaultValue={value} onChange={(e) => onChange(e.target.value)} className={TOOLBAR_SELECT}>
        <option value={ALL}>ทั้งหมด</option>
        {Object.entries(spec.options).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
