import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { style, type ButtonSize, type ButtonVariant } from "./Button.styles";

export type { ButtonSize, ButtonVariant };

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Extra classes from the caller's own styles file (never inline).
  className?: string;
  children?: ReactNode;
}

type ButtonElementProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

type LinkElementProps = CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children">;

// The app's button: a <button> (type="button" unless given), or a Next
// <Link> when `href` is set, in one of the shared looks (Button.styles.ts).
// No hooks, so server and client components both use it.
//
//   <Button variant="primary" href="/review">Start review →</Button>
//   <Button type="submit">Apply</Button>
//   <Button variant="quiet" size="compact" onClick={edit}>Edit note</Button>
export default function Button(props: ButtonElementProps | LinkElementProps) {
  if (props.href !== undefined) {
    const { variant = "secondary", size = "md", className, children, ...linkProps } = props;
    return (
      <Link {...linkProps} className={style.button({ variant, size, className })}>
        {children}
      </Link>
    );
  }
  // href is undefined in this branch; taken out so it isn't put on <button>.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variant = "secondary", size = "md", className, children, type = "button", href, ...buttonProps } = props;
  return (
    <button {...buttonProps} type={type} className={style.button({ variant, size, className })}>
      {children}
    </button>
  );
}
