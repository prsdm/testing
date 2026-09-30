"use client";

import { DownloadIcon, FullscreenIcon, Loader2Icon } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import {
  type LibraryPreviewData,
  libraryPreviewApiUrl,
  useLibraryPreview,
} from "@/hooks/use-library-preview";
import { sheetFileName } from "@/shared/artifacts/sheet-xlsx";
import { textDocumentFileName } from "@/shared/artifacts/text-docx";
import type { LibraryPreviewApiResponse } from "@/shared/library/library-preview-api";
import {
  isLibraryPreviewSupported,
  libraryPreviewKindFromMeta,
  libraryPreviewSkipsServerConversion,
} from "@/shared/library/library-preview-kind";
import { cn, fetcher } from "@/shared/utils";
import { InlineDocumentSkeleton } from "./document-skeleton";
import {
  LibraryDocxPreview,
  LibraryDocxThumbnail,
} from "./library-docx-preview";
import { LibraryPdfPreview, LibraryPdfThumbnail } from "./library-pdf-preview";
import { LibraryPreviewKindIcon } from "./library-preview-icons";
import {
  LibrarySlidePptxThumbnail,
  LibrarySlidesPptxPreview,
} from "./library-slides-pptx-preview";
import {
  LibraryXlsxPreview,
  LibraryXlsxThumbnail,
} from "./library-xlsx-preview";

type LibraryFilePreviewProps = {
  file: {
    id: string;
    name: string;
    contentType: string;
    sizeBytes: number;
    url: string;
  };
  isReadonly: boolean;
};

function createDownloadHandler(preview: LibraryPreviewData) {
  return () => {
    window.open(preview.downloadUrl, "_blank", "noopener,noreferrer");
  };
}

function previewDisplayTitle(preview: LibraryPreviewData) {
  if (preview.kind === "sheet") {
    return sheetFileName(preview.title);
  }
  if (preview.kind === "text") {
    return textDocumentFileName(preview.title);
  }
  return preview.name;
}

function LibraryPreviewBody({ preview }: { preview: LibraryPreviewData }) {
  if (preview.kind === "sheet") {
    return <LibraryXlsxThumbnail url={preview.downloadUrl} />;
  }

  if (preview.kind === "text") {
    return <LibraryDocxThumbnail url={preview.downloadUrl} />;
  }

  if (preview.kind === "slides") {
    return (
      <LibrarySlidePptxThumbnail page={1} total={1} url={preview.downloadUrl} />
    );
  }

  if (preview.kind === "image") {
    return (
      <div className="relative size-full">
        <Image
          alt={preview.name}
          className="object-contain"
          fill
          sizes="560px"
          src={preview.downloadUrl}
          unoptimized
        />
      </div>
    );
  }

  if (preview.kind === "pdf") {
    return <LibraryPdfThumbnail url={preview.downloadUrl} />;
  }

  return (
    <div className="flex size-full items-center justify-center px-4 text-center text-muted-foreground text-sm">
      Preview not available for this file type.
    </div>
  );
}

export function LibraryFilePreview({
  file,
  isReadonly,
}: LibraryFilePreviewProps) {
  const tenantSlug = useTenantSlug();
  const { setPreview } = useLibraryPreview();
  const { setArtifact } = useArtifact();
  const hitboxRef = useRef<HTMLDivElement>(null);

  const supported = isLibraryPreviewSupported({
    contentType: file.contentType,
    name: file.name,
  });

  const kindFromFile = libraryPreviewKindFromMeta({
    contentType: file.contentType,
    name: file.name,
  });
  const needsPreviewApi = !libraryPreviewSkipsServerConversion(kindFromFile);

  const previewUrl =
    tenantSlug && supported && needsPreviewApi
      ? libraryPreviewApiUrl(tenantSlug, file.id, file.sizeBytes)
      : null;

  const { data: preview, isLoading } = useSWR<LibraryPreviewApiResponse>(
    previewUrl,
    fetcher
  );

  const slidesPreview: LibraryPreviewData = {
    contentType: file.contentType,
    downloadUrl: file.url,
    fileId: file.id,
    kind: "slides",
    name: file.name,
    sizeBytes: file.sizeBytes,
    title: file.name,
  };

  const docxPreview: LibraryPreviewData = {
    contentType: file.contentType,
    downloadUrl: file.url,
    fileId: file.id,
    kind: "text",
    name: file.name,
    sizeBytes: file.sizeBytes,
    title: file.name,
  };

  const sheetPreview: LibraryPreviewData = {
    contentType: file.contentType,
    downloadUrl: file.url,
    fileId: file.id,
    kind: "sheet",
    name: file.name,
    sizeBytes: file.sizeBytes,
    title: file.name,
  };

  const pdfPreview: LibraryPreviewData = {
    contentType: file.contentType,
    downloadUrl: file.url,
    fileId: file.id,
    kind: "pdf",
    name: file.name,
    sizeBytes: file.sizeBytes,
    title: file.name,
  };

  const clientRenderedPreview =
    kindFromFile === "slides"
      ? slidesPreview
      : kindFromFile === "text"
        ? docxPreview
        : kindFromFile === "sheet"
          ? sheetPreview
          : kindFromFile === "pdf"
            ? pdfPreview
            : null;
  const activePreview = clientRenderedPreview ?? preview;

  const openPreview = useCallback(
    (event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      if (isReadonly) {
        toast.error(
          "Viewing library files in shared chats is currently not supported."
        );
        return;
      }

      const target = event?.currentTarget ?? hitboxRef.current;
      if (!target) {
        return;
      }

      const boundingBox = target.getBoundingClientRect();
      setArtifact(initialArtifactData);
      setPreview((current) => ({
        ...current,
        boundingBox: {
          height: boundingBox.height,
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
        },
        contentType: file.contentType,
        downloadUrl: file.url,
        fileId: file.id,
        isVisible: true,
        name: file.name,
        sizeBytes: file.sizeBytes,
      }));
    },
    [file, isReadonly, setArtifact, setPreview]
  );

  if (!supported) {
    return null;
  }

  const kind = activePreview?.kind ?? preview?.kind ?? kindFromFile;
  const title = activePreview ? previewDisplayTitle(activePreview) : file.name;
  const onDownload =
    activePreview && activePreview.kind !== "unsupported"
      ? createDownloadHandler(activePreview)
      : () => {
          window.open(file.url, "_blank", "noopener,noreferrer");
        };
  const cardLoading = needsPreviewApi ? isLoading : false;

  return (
    <div className="mt-2 w-full max-w-[480px]" ref={hitboxRef}>
      <div className="flex flex-row items-center justify-between gap-2 rounded-t-lg border border-b-0 border-border/50 bg-background px-3 py-2">
        <div className="flex min-w-0 flex-row items-center gap-2.5">
          <div className="shrink-0 text-muted-foreground">
            {cardLoading ? (
              <Loader2Icon aria-hidden className="size-4 animate-spin" />
            ) : (
              <LibraryPreviewKindIcon compact kind={kind} />
            )}
          </div>
          <div className="truncate font-medium text-sm">{title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            aria-label={`Download ${title}`}
            className="text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <DownloadIcon className="size-4" />
          </Button>
          <Button
            aria-label={`Open ${title}`}
            className="text-muted-foreground"
            onClick={openPreview}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <FullscreenIcon size={16} />
          </Button>
        </div>
      </div>
      <button
        className="block w-full cursor-pointer text-left"
        onClick={openPreview}
        type="button"
      >
        <div
          className={cn(
            "overflow-hidden rounded-b-lg border border-t-0 border-border/50",
            kindFromFile !== "slides" &&
              kindFromFile !== "text" &&
              kindFromFile !== "sheet" &&
              kindFromFile !== "pdf" &&
              "h-[257px]"
          )}
        >
          {cardLoading || !activePreview ? (
            <InlineDocumentSkeleton />
          ) : (
            <LibraryPreviewBody preview={activePreview} />
          )}
        </div>
      </button>
    </div>
  );
}

export function LibraryPreviewPanelContent({
  preview,
  isLoading,
  downloadUrl,
  name,
  contentType,
}: {
  preview: LibraryPreviewData | undefined;
  isLoading: boolean;
  downloadUrl: string;
  name: string;
  contentType: string;
}) {
  const kind =
    preview?.kind ??
    libraryPreviewKindFromMeta({
      contentType,
      name,
    });

  if (kind === "slides" && downloadUrl) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LibrarySlidesPptxPreview url={downloadUrl} />
      </div>
    );
  }

  if (kind === "sheet" && downloadUrl) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LibraryXlsxPreview url={downloadUrl} />
      </div>
    );
  }

  if (kind === "text" && downloadUrl) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LibraryDocxPreview url={downloadUrl} />
      </div>
    );
  }

  if (kind === "pdf" && downloadUrl) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <LibraryPdfPreview url={downloadUrl} />
      </div>
    );
  }

  if (isLoading || !preview) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Loader2Icon
          aria-hidden
          className="size-6 animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  if (
    preview.kind === "slides" ||
    preview.kind === "text" ||
    preview.kind === "sheet" ||
    preview.kind === "pdf"
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-hidden",
        preview.kind === "image" && "flex items-center justify-center p-4"
      )}
    >
      <LibraryPreviewBody preview={preview} />
    </div>
  );
}
