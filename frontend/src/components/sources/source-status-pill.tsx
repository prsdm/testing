import type { KbIndexStatus } from "@/shared/sources/source-item-status";
import { cn } from "@/shared/utils";

const statusPillClassName: Record<KbIndexStatus, string> = {
  added: "border-border/60 bg-muted/30 text-muted-foreground",
  indexed:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
  not_indexed: "border-border/60 bg-muted/30 text-muted-foreground",
  update_available:
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400",
};

const statusPillLabel: Record<KbIndexStatus, string> = {
  added: "Added",
  indexed: "Indexed",
  not_indexed: "Not indexed",
  update_available: "Not updated",
};

export function KbStatusPill({ status }: { status: KbIndexStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center justify-center whitespace-nowrap rounded-lg border px-2.5 font-medium text-xs",
        statusPillClassName[status]
      )}
    >
      {statusPillLabel[status]}
    </span>
  );
}
