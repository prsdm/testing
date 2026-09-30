"use client";

import { type RefObject, useCallback } from "react";
import { clampLibraryPreviewPanelWidth } from "@/lib/library/library-preview-layout";
import { cn } from "@/shared/utils";

type LibraryPreviewResizeHandleProps = {
  containerRef: RefObject<HTMLElement | null>;
  panelWidthPercent: number;
  onWidthChange: (percent: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
};

export function LibraryPreviewResizeHandle({
  containerRef,
  panelWidthPercent,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: LibraryPreviewResizeHandleProps) {
  const startResize = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      onResizeStart?.();

      const containerRect = container.getBoundingClientRect();
      const startWidth = panelWidthPercent;

      const handlePointerMove = (event: PointerEvent) => {
        const deltaPercent =
          ((clientX - event.clientX) / containerRect.width) * 100;
        onWidthChange(clampLibraryPreviewPanelWidth(startWidth + deltaPercent));
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        onResizeEnd?.();
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [containerRef, onResizeEnd, onResizeStart, onWidthChange, panelWidthPercent]
  );

  return (
    <button
      aria-label="Resize preview panel"
      className={cn(
        "relative z-20 hidden h-dvh w-px shrink-0 cursor-col-resize touch-none bg-border md:block",
        "before:absolute before:inset-y-0 before:-left-1.5 before:w-3 before:content-['']",
        "hover:bg-muted-foreground/30"
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        startResize(event.clientX);
      }}
      type="button"
    />
  );
}
