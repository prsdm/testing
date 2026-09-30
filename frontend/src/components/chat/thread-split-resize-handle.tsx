"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type RefObject, useCallback } from "react";
import { cn } from "@/shared/utils";

/** Left (inbox list) pane width; thread pane gets the remainder. Default 30 / 70. */
export const THREAD_SPLIT_MAIN_MIN_PERCENT = 28;
/** List pane cannot grow past default (no drag-to-widen toward the thread). */
export const THREAD_SPLIT_MAIN_MAX_PERCENT = 30;
export const THREAD_SPLIT_MAIN_DEFAULT_PERCENT = 30;

export function clampThreadChannelPaneWidth(percent: number) {
  return Math.min(
    THREAD_SPLIT_MAIN_MAX_PERCENT,
    Math.max(THREAD_SPLIT_MAIN_MIN_PERCENT, percent)
  );
}

/** Tolaria-style tab on the split edge to show/hide the inbox list. */
export function ChannelInboxPaneCollapseToggle({
  collapsed,
  listPaneWidthPercent = THREAD_SPLIT_MAIN_DEFAULT_PERCENT,
  onToggle,
}: {
  collapsed: boolean;
  listPaneWidthPercent?: number;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={!collapsed}
      aria-label={
        collapsed ? "Show conversation list" : "Hide conversation list"
      }
      className={cn(
        "absolute top-1/2 z-30 flex -translate-y-1/2 cursor-pointer items-center justify-center",
        "h-11 w-3.5 rounded-r-md border border-border/80 border-l-0 bg-background shadow-sm",
        "text-muted-foreground transition-[left,colors] duration-200 ease-out",
        "hover:bg-muted/60 hover:text-foreground max-md:hidden"
      )}
      onClick={onToggle}
      style={{
        left: collapsed
          ? 0
          : `calc(${clampThreadChannelPaneWidth(listPaneWidthPercent)}% + 1px)`,
      }}
      type="button"
    >
      {collapsed ? (
        <ChevronRightIcon aria-hidden className="size-3.5 stroke-[2.5]" />
      ) : (
        <ChevronLeftIcon aria-hidden className="size-3.5 stroke-[2.5]" />
      )}
    </button>
  );
}

type ThreadSplitResizeHandleProps = {
  containerRef: RefObject<HTMLElement | null>;
  channelPaneWidthPercent: number;
  onWidthChange: (percent: number) => void;
};

export function ThreadSplitResizeHandle({
  containerRef,
  channelPaneWidthPercent,
  onWidthChange,
}: ThreadSplitResizeHandleProps) {
  const startResize = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const startWidth = channelPaneWidthPercent;

      const handlePointerMove = (event: PointerEvent) => {
        const deltaPercent =
          ((event.clientX - clientX) / containerRect.width) * 100;
        onWidthChange(clampThreadChannelPaneWidth(startWidth + deltaPercent));
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [channelPaneWidthPercent, containerRef, onWidthChange]
  );

  const splitLeft = clampThreadChannelPaneWidth(channelPaneWidthPercent);

  return (
    <button
      aria-label="Resize channel panel"
      className={cn(
        "absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-col-resize touch-none bg-transparent max-md:hidden md:block"
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        startResize(event.clientX);
      }}
      style={{ left: `calc(${splitLeft}% + 0.5px)` }}
      type="button"
    />
  );
}
