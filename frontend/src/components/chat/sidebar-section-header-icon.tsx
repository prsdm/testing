"use client";

import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils";

export function SidebarSectionHeaderIcon({
  expanded,
  icon: Icon,
}: {
  expanded: boolean;
  icon: LucideIcon;
}) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <Icon
        aria-hidden
        className="size-4 shrink-0 group-hover/menu-item:hidden"
      />
      <ChevronRightIcon
        aria-hidden
        className={cn(
          "absolute hidden size-4 shrink-0 transition-transform duration-150 group-hover/menu-item:block",
          expanded && "rotate-90"
        )}
      />
    </span>
  );
}
