import type { HTMLAttributes } from "react";
import { style } from "./Card.styles";

// A card: the surface, hairline border, card radius and shadow. Padding and
// layout are the caller's (`className`, from its own styles file), since
// cards differ there (p-5 sections, p-4 list panels, flush tables). Renders
// a <div>, or the element `as` names (a <section> for a titled block).
//
//   <Card as="section" className={style.section} aria-labelledby="…">…</Card>
export default function Card({
  as: Element = "div",
  className,
  ...rest
}: { as?: "div" | "section" | "article" | "aside" } & HTMLAttributes<HTMLElement>) {
  return <Element {...rest} className={style.card(className)} />;
}
