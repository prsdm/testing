"use client";

import { XIcon } from "lucide-react";
import { type ThreadTag, threadTagColorStyle } from "@/shared/chat/thread-tags";
import { cn } from "@/shared/utils";

export function ThreadTagPill({
  className,
  onRemove,
  tag,
  variant = "header",
}: {
  className?: string;
  onRemove?: () => void;
  tag: ThreadTag;
  /** Slightly taller pill on channel inbox cards only. */
  variant?: "card" | "header";
}) {
  const colors = threadTagColorStyle(tag);

  const isCard = variant === "card";

  return (
    <span
      className={cn(
        "inline-flex max-w-[9rem] items-center rounded leading-none",
        isCard
          ? "h-[24px] gap-1 rounded-md px-2 text-[12px]"
          : "gap-1.5 rounded py-0.5 pr-2 pl-2 text-xs",
        colors.pill,
        onRemove ? (isCard ? "pr-0.5" : "pr-1") : undefined,
        className
      )}
    >
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", "size-1.5", colors.dot)}
      />
      <span className={cn("truncate", isCard ? "font-normal" : "font-medium")}>
        {tag.label}
      </span>
      {onRemove ? (
        <button
          aria-label={`Remove ${tag.label} tag`}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          type="button"
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

export function ThreadTagPillRow({
  className,
  onRemoveTag,
  tags,
  variant = "header",
}: {
  className?: string;
  onRemoveTag?: (label: string) => void;
  tags: ThreadTag[];
  variant?: "card" | "header";
}) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center",
        variant === "card" ? "gap-1" : "gap-1.5",
        className
      )}
    >
      {tags.map((tag) => (
        <ThreadTagPill
          key={tag.label}
          onRemove={onRemoveTag ? () => onRemoveTag(tag.label) : undefined}
          tag={tag}
          variant={variant}
        />
      ))}
    </span>
  );
}
