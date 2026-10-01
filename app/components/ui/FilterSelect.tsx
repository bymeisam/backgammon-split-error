import { style } from "./FilterSelect.styles";

// A labelled <select> inside a plain GET <form> — uncontrolled
// (defaultValue), so it works from a server component and submits as a
// query param. `emptyLabel`, when given, adds a leading "no filter" option
// with an empty value.
export function FilterSelect({
  label,
  name,
  defaultValue,
  options,
  emptyLabel,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <label className={style.field}>
      {label}
      <select name={name} defaultValue={defaultValue} className={style.select}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Suspense fallback for FilterSelects whose options are still loading.
export function FilterSelectFallback({ labels }: { labels: string[] }) {
  return (
    <>
      {labels.map((label) => (
        <label key={label} className={style.field}>
          {label}
          <select disabled className={style.disabledSelect}>
            <option>Loading…</option>
          </select>
        </label>
      ))}
    </>
  );
}
