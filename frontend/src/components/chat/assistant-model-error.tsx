"use client";

import type { ModelErrorPresentation } from "@/shared/ai/format-model-error-message";
import { formatModelErrorLine } from "@/shared/ai/format-model-error-message";
import { cn } from "@/shared/utils";
import { activityChipClassName } from "./activity-chip-list";

export function AssistantModelError({
  error,
}: {
  error: ModelErrorPresentation;
}) {
  const line = formatModelErrorLine(error);

  return (
    <span
      className={cn(
        activityChipClassName,
        "max-w-full border-destructive/20 bg-destructive/5 text-destructive"
      )}
      data-testid="assistant-model-error"
      title={line}
    >
      <span className="truncate">{line}</span>
    </span>
  );
}
