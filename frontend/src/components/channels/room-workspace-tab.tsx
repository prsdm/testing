"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils";

export function RoomWorkspaceTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cn(
        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md p-0 font-medium text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden className="size-4 shrink-0" />
    </button>
  );
}
