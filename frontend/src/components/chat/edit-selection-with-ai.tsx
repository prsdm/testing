"use client";

import { Button } from "@/components/ui/button";
import { SparklesIcon } from "./icons";

type EditSelectionWithAiProps = {
  top: number;
  left: number;
  onEdit: () => void;
};

export function EditSelectionWithAi({
  top,
  left,
  onEdit,
}: EditSelectionWithAiProps) {
  return (
    <div
      className="pointer-events-auto fixed z-50 flex -translate-y-full items-center gap-1 rounded-lg border border-border/60 bg-background p-1 shadow-md"
      style={{ left: Math.max(8, left), top: Math.max(8, top - 8) }}
    >
      <Button
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={onEdit}
        onMouseDown={(event) => {
          // Keep ProseMirror selection until we copy the text.
          event.preventDefault();
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <SparklesIcon size={12} />
        Edit with AI
      </Button>
    </div>
  );
}
