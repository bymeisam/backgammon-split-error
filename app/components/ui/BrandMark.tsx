import { style } from "./BrandMark.styles";

// The brand mark: two overlapping checkers, in currentColor. Decorative
// (aria-hidden); size it through `className` from the caller's styles file.
//
//   <BrandMark className={style.brandMark} />
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={style.mark(className)}>
      <circle cx={9} cy={12} r={7.5} className={style.back} />
      <circle cx={15.5} cy={12} r={7} strokeWidth={1.5} className={style.front} />
    </svg>
  );
}
