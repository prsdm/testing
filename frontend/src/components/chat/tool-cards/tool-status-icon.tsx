"use client";

import {
  AlertCircleIcon,
  BanIcon,
  CheckSquareIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/shared/utils";

export type ToolCallStatus =
  | "pending"
  | "completed"
  | "failed"
  | "denied"
  | "interrupted";

export function ToolStatusIcon({
  status,
  className,
}: {
  status: ToolCallStatus;
  className?: string;
}) {
  const baseClass = cn("size-4 shrink-0", className);

  if (status === "pending") {
    return (
      <Loader2Icon
        aria-hidden
        className={cn(baseClass, "animate-spin text-muted-foreground")}
      />
    );
  }

  if (status === "failed") {
    return (
      <AlertCircleIcon
        aria-hidden
        className={cn(baseClass, "text-destructive")}
      />
    );
  }

  if (status === "denied") {
    return (
      <BanIcon aria-hidden className={cn(baseClass, "text-destructive")} />
    );
  }

  if (status === "interrupted") {
    return (
      <BanIcon aria-hidden className={cn(baseClass, "text-muted-foreground")} />
    );
  }

  return (
    <CheckSquareIcon
      aria-hidden
      className={cn(baseClass, "text-emerald-600/80 dark:text-emerald-500/80")}
    />
  );
}
