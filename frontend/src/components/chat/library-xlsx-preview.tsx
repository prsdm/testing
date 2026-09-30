"use client";

import type { IWorkbookData } from "@univerjs/core";
import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils";

import "@univerjs/preset-sheets-core/lib/index.css";

type UniverPreviewHandle = {
  dispose: () => void;
};

async function fetchXlsxFile(url: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to load spreadsheet.");
  }
  const buffer = await response.arrayBuffer();
  return new File([buffer], "preview.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function withSuppressedChartImportWarnings<T>(run: () => Promise<T>) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes("Failed to process chart/graphic")
    ) {
      return;
    }
    originalWarn(...args);
  };

  return run().finally(() => {
    console.warn = originalWarn;
  });
}

async function xlsxFileToWorkbook(file: File): Promise<IWorkbookData> {
  const { default: LuckyExcel } = await import(
    "@mertdeveci55/univer-import-export"
  );

  return withSuppressedChartImportWarnings(
    () =>
      new Promise((resolve, reject) => {
        LuckyExcel.transformExcelToUniver(
          file,
          (workbook) => {
            resolve(workbook);
          },
          (error) => {
            reject(error);
          }
        ).catch(reject);
      })
  );
}

async function mountUniverPreview(
  container: HTMLElement,
  workbookData: IWorkbookData,
  compact: boolean
): Promise<UniverPreviewHandle> {
  const [
    { UniverSheetsCorePreset },
    UniverPresetSheetsCoreEnUS,
    { createUniver, LocaleType, mergeLocales },
  ] = await Promise.all([
    import("@univerjs/preset-sheets-core"),
    import("@univerjs/preset-sheets-core/locales/en-US"),
    import("@univerjs/presets"),
  ]);

  const { univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS.default),
    },
    presets: [
      UniverSheetsCorePreset({
        container,
        contextMenu: compact ? false : undefined,
        footer: compact
          ? { menus: false, sheetBar: true, zoomSlider: false }
          : { sheetBar: true },
        formulaBar: compact ? false : undefined,
        toolbar: compact ? false : undefined,
      }),
    ],
  });

  univerAPI.createWorkbook(workbookData);

  univerAPI.addEvent(univerAPI.Event.LifeCycleChanged, ({ stage }) => {
    if (stage !== univerAPI.Enum.LifecycleStages.Rendered) {
      return;
    }
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) {
      return;
    }
    if (compact) {
      workbook.disableSelection();
    }
    const permission = workbook.getWorkbookPermission();
    permission.setReadOnly();
    permission.setPermissionDialogVisible(false);
  });

  return {
    dispose: () => {
      univerAPI.dispose();
    },
  };
}

function LibraryXlsxMount({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let preview: UniverPreviewHandle | null = null;
    let cancelled = false;

    async function loadPreview() {
      setIsLoading(true);
      setError(null);

      try {
        const file = await fetchXlsxFile(url);
        if (cancelled || !containerRef.current) {
          return;
        }

        const workbookData = await xlsxFileToWorkbook(file);
        if (cancelled || !containerRef.current) {
          return;
        }

        preview?.dispose();
        preview = await mountUniverPreview(
          containerRef.current,
          workbookData,
          compact
        );
        if (!cancelled) {
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Could not preview this spreadsheet.");
          setIsLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
      preview?.dispose();
    };
  }, [url, compact]);

  if (error) {
    return (
      <div className="flex size-full items-center justify-center p-4 text-center text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="relative size-full min-h-0 min-w-0">
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <Loader2Icon
            aria-hidden
            className="size-6 animate-spin text-muted-foreground"
          />
        </div>
      ) : null}
      <div
        className={cn(
          "univer-library-preview size-full min-h-0 min-w-0 overflow-hidden",
          compact && "[&_.univer-workbench]:!min-h-0"
        )}
        ref={containerRef}
      />
    </div>
  );
}

export function LibraryXlsxPreview({ url }: { url: string }) {
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <LibraryXlsxMount url={url} />
    </div>
  );
}

export function LibraryXlsxThumbnail({ url }: { url: string }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-b-lg bg-white">
      <LibraryXlsxMount compact url={url} />
    </div>
  );
}
