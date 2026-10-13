import clsx from "clsx";

export const style = {
  // Function, 1 param -> passed directly. The caller sizes the mark (and may
  // colour it) through `className`; the back checker takes currentColor.
  mark: (className?: string): string => clsx("shrink-0", className),
  back: "fill-current",
  front: "fill-surface stroke-current",
} as const;
