import { CircleX, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

export function StatusBanner({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "error" | "info";
}) {
  const isError = variant === "error";
  const Icon = isError ? CircleX : Info;

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 overflow-hidden rounded-lg border px-4 py-3",
        isError
          ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
          : "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100"
      )}
      role={isError ? "alert" : "status"}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          isError
            ? "text-red-600 dark:text-red-400"
            : "text-blue-600 dark:text-blue-400"
        )}
      />
      <p className="min-w-0 flex-1 text-sm wrap-break-word [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </p>
    </div>
  );
}
