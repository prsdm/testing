import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

export function ConnectorCard({
  action,
  banner,
  children,
  className,
  error,
}: {
  action?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  className?: string;
  error?: string | null;
}) {
  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-lg border border-border/60 px-4 py-3.5",
        className
      )}
    >
      <div className="flex flex-1 flex-col gap-2">
        {banner}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{children}</div>
          {action ? (
            <div className="shrink-0 self-center [&_a]:cursor-pointer [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed **[data-slot=dropdown-menu-item]:cursor-pointer">
              {action}
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive text-xs leading-snug">{error}</p>
        ) : null}
      </div>
    </section>
  );
}
