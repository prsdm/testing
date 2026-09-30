import type { ComponentProps, ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

type NextLinkProps = Omit<
  ComponentProps<typeof RouterLink>,
  "to" | "prefetch"
> & {
  href: string;
  children: ReactNode;
  prefetch?: boolean | null;
};

/** Minimal `next/link` compatibility for workspace pages in the SPA. */
export default function Link({
  href,
  children,
  prefetch: _prefetch,
  ...rest
}: NextLinkProps) {
  return (
    <RouterLink to={href} {...rest}>
      {children}
    </RouterLink>
  );
}
