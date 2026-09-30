"use client";

import { CornerDownLeftIcon, XIcon } from "lucide-react";
import { truncateSelectionPreview } from "./composer-inject";

type DocumentSelectionChipProps = {
  text: string;
  title?: string;
  onRemove?: () => void;
  /** Compact chip inside a sent user message. */
  compact?: boolean;
};

export function DocumentSelectionChip({
  text,
  title,
  onRemove,
  compact = false,
}: DocumentSelectionChipProps) {
  const preview = truncateSelectionPreview(text, compact ? 100 : 140);

  return (
    <div
      className={
        compact
          ? "flex w-full max-w-md items-start gap-2 rounded-xl bg-muted/70 px-2.5 py-2 text-left"
          : "flex w-full items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-left"
      }
    >
      <CornerDownLeftIcon
        aria-hidden
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        {title ? (
          <div className="mb-0.5 truncate text-[11px] text-muted-foreground">
            {title}
          </div>
        ) : null}
        <div className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
          {preview}
        </div>
      </div>
      {onRemove ? (
        <button
          aria-label="Remove selected text"
          className="mt-0.5 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onRemove}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
