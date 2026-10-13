import { useId } from "react";
import { style } from "./forum.styles";

// The post-level "Hide engine analysis" checkbox, shared by the new-post form
// and the post edit form (both client components), so the label and hint are
// written once.
export default function HideAnalysisCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const hintId = useId();
  return (
    <div className={style.checkboxField}>
      <label className={style.checkboxLabel}>
        <input
          type="checkbox"
          className={style.checkbox}
          checked={checked}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.checked)}
        />
        Hide engine analysis
      </label>
      <p id={hintId} className={style.checkboxHint}>
        Readers won&apos;t be able to open the analysis on this post.
      </p>
    </div>
  );
}
