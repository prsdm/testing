import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

/** White tile + hairline border for third-party marks in admin list rows. */
export function AdminListItemLogoFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background p-1.5",
        className
      )}
    >
      {children}
    </span>
  );
}
