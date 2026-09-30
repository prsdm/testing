"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

export function ToolCardSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-b-md border border-border/60 bg-muted/20",
        "max-h-72 overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolCardSection({
  children,
  divider = false,
  tinted = false,
  className,
}: {
  children: ReactNode;
  divider?: boolean;
  tinted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-3 py-2",
        divider && "border-border/60 border-t",
        tinted && "bg-muted/40",
        className
      )}
    >
      {children}
    </div>
  );
}
