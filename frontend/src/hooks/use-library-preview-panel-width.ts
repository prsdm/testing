"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clampLibraryPreviewPanelWidth,
  LIBRARY_PREVIEW_PANEL_DEFAULT_PERCENT,
  LIBRARY_PREVIEW_PANEL_WIDTH_STORAGE_KEY,
} from "@/lib/library/library-preview-layout";

function readStoredPanelWidth() {
  if (typeof window === "undefined") {
    return LIBRARY_PREVIEW_PANEL_DEFAULT_PERCENT;
  }

  const raw = window.localStorage.getItem(
    LIBRARY_PREVIEW_PANEL_WIDTH_STORAGE_KEY
  );
  if (!raw) {
    return LIBRARY_PREVIEW_PANEL_DEFAULT_PERCENT;
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return LIBRARY_PREVIEW_PANEL_DEFAULT_PERCENT;
  }

  return clampLibraryPreviewPanelWidth(parsed);
}

export function useLibraryPreviewPanelWidth() {
  const [panelWidthPercent, setPanelWidthPercentState] = useState(
    LIBRARY_PREVIEW_PANEL_DEFAULT_PERCENT
  );
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setPanelWidthPercentState(readStoredPanelWidth());
  }, []);

  const setPanelWidthPercent = useCallback((next: number) => {
    const clamped = clampLibraryPreviewPanelWidth(next);
    setPanelWidthPercentState(clamped);
    window.localStorage.setItem(
      LIBRARY_PREVIEW_PANEL_WIDTH_STORAGE_KEY,
      String(clamped)
    );
  }, []);

  return {
    chatWidthPercent: 100 - panelWidthPercent,
    isResizing,
    panelWidthPercent,
    setIsResizing,
    setPanelWidthPercent,
  };
}
