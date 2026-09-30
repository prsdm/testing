"use client";

import { useState } from "react";
import { cn } from "@/shared/utils";

export const activityChipClassName =
  "inline-flex h-6 items-center rounded-md border border-border/60 bg-muted/50 px-2.5 text-foreground text-xs";

type ActivityChipListProps = {
  items: string[];
  initialCount?: number;
  className?: string;
  variant?: "query" | "source";
};

export function ActivityChipList({
  items,
  initialCount = 8,
  className,
  variant: _variant = "query",
}: ActivityChipListProps) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const visibleItems = items.slice(0, visibleCount);
  const remaining = items.length - visibleItems.length;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visibleItems.map((item) => (
        <span
          className={cn(activityChipClassName, "max-w-xs min-w-0")}
          key={item}
          title={item}
        >
          <span className="block truncate">{item}</span>
        </span>
      ))}
      {remaining > 0 ? (
        <button
          className={cn(
            activityChipClassName,
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          )}
          onClick={() => setVisibleCount((count) => count + initialCount)}
          type="button"
        >
          +{remaining} more
        </button>
      ) : null}
    </div>
  );
}
