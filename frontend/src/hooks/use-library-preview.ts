"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";

export type LibraryPreviewData = {
  fileId: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  kind: "sheet" | "text" | "slides" | "image" | "pdf" | "unsupported";
  title: string;
  content?: string;
  error?: string;
};

export type LibraryPreviewPanelState = {
  fileId: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  isVisible: boolean;
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
};

export const initialLibraryPreviewState: LibraryPreviewPanelState = {
  boundingBox: {
    height: 0,
    left: 0,
    top: 0,
    width: 0,
  },
  contentType: "",
  downloadUrl: "",
  fileId: "",
  isVisible: false,
  name: "",
  sizeBytes: 0,
};

type Selector<T> = (state: LibraryPreviewPanelState) => T;

export function useLibraryPreviewSelector<Selected>(
  selector: Selector<Selected>
) {
  const { data } = useSWR<LibraryPreviewPanelState>("library-preview", null, {
    fallbackData: initialLibraryPreviewState,
  });

  return useMemo(
    () => selector(data ?? initialLibraryPreviewState),
    [data, selector]
  );
}

export function useLibraryPreview() {
  const { data, mutate } = useSWR<LibraryPreviewPanelState>(
    "library-preview",
    null,
    {
      fallbackData: initialLibraryPreviewState,
    }
  );

  const preview = useMemo(() => data ?? initialLibraryPreviewState, [data]);

  const setPreview = useCallback(
    (
      updater:
        | LibraryPreviewPanelState
        | ((current: LibraryPreviewPanelState) => LibraryPreviewPanelState)
    ) => {
      mutate((current) => {
        const base = current ?? initialLibraryPreviewState;
        if (typeof updater === "function") {
          return updater(base);
        }
        return updater;
      });
    },
    [mutate]
  );

  const closePreview = useCallback(() => {
    setPreview(initialLibraryPreviewState);
  }, [setPreview]);

  return useMemo(
    () => ({
      closePreview,
      preview,
      setPreview,
    }),
    [preview, setPreview, closePreview]
  );
}

export function libraryPreviewApiUrl(
  tenantSlug: string,
  fileId: string,
  sizeBytes: number
) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  return `${basePath}/api/library/${tenantSlug}/${fileId}/preview?v=${sizeBytes}`;
}
