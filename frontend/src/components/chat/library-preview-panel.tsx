"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DownloadIcon, XIcon } from "lucide-react";
import useSWR from "swr";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import {
  libraryPreviewApiUrl,
  useLibraryPreview,
  useLibraryPreviewSelector,
} from "@/hooks/use-library-preview";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LibraryPreviewApiResponse } from "@/shared/library/library-preview-api";
import {
  isLibraryCloudExportSupportedKind,
  libraryPreviewKindFromMeta,
  libraryPreviewSkipsServerConversion,
} from "@/shared/library/library-preview-kind";
import { cn, fetcher } from "@/shared/utils";
import { LibraryCloudExportMenu } from "./library-cloud-export-menu";
import { LibraryPreviewPanelContent } from "./library-file-preview";
import { LibraryPreviewKindIcon } from "./library-preview-icons";

function panelDownloadHandler(preview: LibraryPreviewApiResponse) {
  return () => {
    window.open(preview.downloadUrl, "_blank", "noopener,noreferrer");
  };
}

type LibraryPreviewPanelProps = {
  panelWidthPercent: number;
  isResizing?: boolean;
};

export function LibraryPreviewPanel({
  panelWidthPercent,
  isResizing = false,
}: LibraryPreviewPanelProps) {
  const isMobile = useIsMobile();
  const tenantSlug = useTenantSlug();
  const { preview, closePreview } = useLibraryPreview();
  const isVisible = useLibraryPreviewSelector((state) => state.isVisible);

  const kindFromMeta = libraryPreviewKindFromMeta({
    contentType: preview.contentType,
    name: preview.name,
  });
  const needsPreviewApi = !libraryPreviewSkipsServerConversion(kindFromMeta);

  const previewUrl =
    tenantSlug && preview.fileId && isVisible && needsPreviewApi
      ? libraryPreviewApiUrl(tenantSlug, preview.fileId, preview.sizeBytes)
      : null;

  const { data, isLoading } = useSWR<LibraryPreviewApiResponse>(
    previewUrl,
    fetcher
  );

  const title = data?.name ?? preview.name;
  const kind = data?.kind ?? kindFromMeta;
  const panelLoading = needsPreviewApi && isLoading;
  const onDownload =
    data && data.kind !== "unsupported"
      ? panelDownloadHandler(data)
      : preview.downloadUrl
        ? () => {
            window.open(preview.downloadUrl, "_blank", "noopener,noreferrer");
          }
        : undefined;
  const showCloudExport =
    Boolean(tenantSlug && preview.fileId) &&
    isLibraryCloudExportSupportedKind(kind);

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "flex h-dvh min-w-0 shrink-0 flex-col overflow-hidden bg-background",
            isMobile ? "w-full" : "max-w-[50%]"
          )}
          exit={{ opacity: 0, x: 16 }}
          initial={{ opacity: 0, x: 16 }}
          style={
            isMobile
              ? undefined
              : {
                  transition: isResizing
                    ? "none"
                    : "width 300ms cubic-bezier(0.32, 0.72, 0, 1)",
                  width: `${panelWidthPercent}%`,
                }
          }
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="flex items-center justify-between gap-2 border-border border-b px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <LibraryPreviewKindIcon className="size-8" kind={kind} />
              <h2 className="min-w-0 truncate font-semibold text-base text-foreground">
                {title}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {showCloudExport && tenantSlug ? (
                <LibraryCloudExportMenu
                  driveWebViewLink={data?.driveWebViewLink}
                  fileId={preview.fileId}
                  tenantSlug={tenantSlug}
                />
              ) : null}
              {onDownload ? (
                <Button
                  aria-label={`Download ${title}`}
                  className="text-muted-foreground"
                  onClick={onDownload}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <DownloadIcon className="size-4" />
                </Button>
              ) : null}
              <button
                aria-label="Close preview"
                className="inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={closePreview}
                type="button"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          </div>
          <LibraryPreviewPanelContent
            contentType={preview.contentType}
            downloadUrl={preview.downloadUrl}
            isLoading={panelLoading}
            name={preview.name}
            preview={data}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
