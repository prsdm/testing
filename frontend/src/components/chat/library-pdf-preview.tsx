"use client";

import { Loader2Icon } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  previewPanelFillScale,
  resolveMaxPreviewLayoutWidth,
  resolvePreviewLayoutWidth,
} from "@/lib/library/library-preview-layout";
import { cn } from "@/shared/utils";

import "pdfjs-dist/web/pdf_viewer.css";

const PDF_PAGE_INDEX_ATTR = "data-pdf-page-index";
const PDF_PAGE_WRAPPER_ATTR = "data-pdf-page-wrapper";
const PDF_SCALE_HOST_ATTR = "data-pdf-scale-host";
const PDF_PAGE_CANVAS_ATTR = "data-pdf-page-canvas";
const PDF_PAGE_BADGE_ATTR = "data-pdf-page-badge";

const PDF_PAGE_BADGE_CLASS =
  "pointer-events-none absolute right-2 bottom-2 z-10 w-max whitespace-nowrap rounded-sm bg-black/75 px-2 py-1 font-medium text-[11px] text-white tabular-nums sm:right-3 sm:bottom-3 sm:px-2.5 sm:text-xs";

type PdfTextLayer = {
  cancel: () => void;
};

let pdfJsModule: Awaited<typeof import("pdfjs-dist")> | null = null;
let pdfJsWorkerConfigured = false;

async function loadPdfJs(): Promise<Awaited<typeof import("pdfjs-dist")>> {
  if (pdfJsModule) {
    return pdfJsModule;
  }

  pdfJsModule = await import("pdfjs-dist");

  if (!pdfJsWorkerConfigured) {
    pdfJsModule.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfJsModule.version}/build/pdf.worker.min.mjs`;
    pdfJsWorkerConfigured = true;
  }

  return pdfJsModule;
}

async function fetchPdfDocument(url: string): Promise<PDFDocumentProxy> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to load PDF.");
  }

  const pdfjs = await loadPdfJs();
  const data = await response.arrayBuffer();
  return pdfjs.getDocument({ data }).promise;
}

function waitForLayoutWidth(element: HTMLElement) {
  if (element.clientWidth > 0) {
    return Promise.resolve(element.clientWidth);
  }

  return new Promise<number>((resolve) => {
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      if (width > 0) {
        observer.disconnect();
        resolve(width);
      }
    });
    observer.observe(element);
  });
}

function decoratePdfPageBadge(
  pageItem: HTMLElement,
  page: number,
  total: number
) {
  pageItem.querySelector(`[${PDF_PAGE_BADGE_ATTR}]`)?.remove();

  const badge = document.createElement("div");
  badge.setAttribute(PDF_PAGE_BADGE_ATTR, "true");
  badge.className = PDF_PAGE_BADGE_CLASS;
  badge.textContent = `Page ${page} / ${total}`;
  pageItem.append(badge);
}

async function renderPdfPageCanvas(
  page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>,
  canvas: HTMLCanvasElement,
  renderScale: number
) {
  const baseViewport = page.getViewport({ scale: 1 });
  const pageWidth = baseViewport.width;
  const pageHeight = baseViewport.height;
  const pixelRatio = window.devicePixelRatio || 1;
  const renderViewport = page.getViewport({ scale: renderScale * pixelRatio });
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not render PDF page.");
  }

  canvas.width = Math.floor(renderViewport.width);
  canvas.height = Math.floor(renderViewport.height);
  // Natural page box — high-res bitmap is downsampled by the browser (same idea as pptx DOM).
  canvas.style.width = `${pageWidth}px`;
  canvas.style.height = `${pageHeight}px`;
  canvas.dataset.pageWidth = String(pageWidth);
  canvas.dataset.pageHeight = String(pageHeight);

  await page.render({
    canvas,
    canvasContext: context,
    viewport: renderViewport,
  }).promise;
}

async function renderPdfPageTextLayer(
  page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>,
  container: HTMLElement
) {
  const pdfjs = await loadPdfJs();
  const textLayer = new pdfjs.TextLayer({
    container,
    textContentSource: await page.getTextContent(),
    viewport: page.getViewport({ scale: 1 }),
  });

  await textLayer.render();
  return textLayer;
}

/** CSS-only resize — identical to library-slides-pptx-preview patchSingleSlideMetrics. */
function patchSinglePdfPageMetrics(
  pageItem: HTMLElement,
  containerWidth: number,
  options?: {
    fillCard?: boolean;
  }
) {
  const canvas = pageItem.querySelector<HTMLCanvasElement>(
    `[${PDF_PAGE_CANVAS_ATTR}]`
  );
  const scaleHost = pageItem.querySelector<HTMLElement>(
    `[${PDF_SCALE_HOST_ATTR}]`
  );
  const wrapper = pageItem.querySelector<HTMLElement>(
    `[${PDF_PAGE_WRAPPER_ATTR}]`
  );
  if (!(canvas && scaleHost && wrapper)) {
    return;
  }

  const pageWidth = Number(canvas.dataset.pageWidth);
  const pageHeight = Number(canvas.dataset.pageHeight);
  if (!(pageWidth > 0 && pageHeight > 0 && containerWidth > 0)) {
    return;
  }

  const scale = previewPanelFillScale(containerWidth, pageWidth);
  const displayWidth = pageWidth * scale;
  const displayHeight = pageHeight * scale;

  wrapper.style.width = `${displayWidth}px`;
  wrapper.style.height = `${displayHeight}px`;
  wrapper.style.willChange = "width, height";
  scaleHost.style.width = `${pageWidth}px`;
  scaleHost.style.height = `${pageHeight}px`;
  scaleHost.style.transform = `scale(${scale})`;
  scaleHost.style.transformOrigin = "top left";
  scaleHost.style.willChange = "transform";

  if (options?.fillCard) {
    pageItem.style.width = "100%";
    pageItem.style.height = "100%";
    pageItem.style.display = "flex";
    pageItem.style.alignItems = "flex-start";
    pageItem.style.justifyContent = "center";
  } else {
    pageItem.style.width = `${displayWidth}px`;
    pageItem.style.marginLeft = "auto";
    pageItem.style.marginRight = "auto";
  }
}

function patchPdfMetrics(
  mount: HTMLElement,
  containerWidth: number,
  options?: {
    fillCard?: boolean;
    firstPageOnly?: boolean;
  }
) {
  if (containerWidth <= 0) {
    return;
  }

  for (const pageItem of mount.querySelectorAll<HTMLElement>(
    `[${PDF_PAGE_INDEX_ATTR}]`
  )) {
    if (options?.firstPageOnly && pageItem.dataset.pdfPageIndex !== "0") {
      continue;
    }

    patchSinglePdfPageMetrics(pageItem, containerWidth, {
      fillCard: options?.fillCard,
    });
  }
}

function resolvePdfContainerWidth(
  mount: HTMLElement,
  scrollRef: RefObject<HTMLDivElement | null>,
  fillCard: boolean
) {
  return fillCard
    ? mount.clientWidth
    : resolvePreviewLayoutWidth(mount, scrollRef.current);
}

function usePdfResizeLoop(
  mountRef: RefObject<HTMLDivElement | null>,
  scrollRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  options?: {
    fillCard?: boolean;
    firstPageOnly?: boolean;
  }
) {
  const fillCard = options?.fillCard ?? false;
  const firstPageOnly = options?.firstPageOnly ?? false;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let resizeLoopId: number | null = null;
    let resizeEndTimer: ReturnType<typeof setTimeout> | null = null;
    let isActivelyResizing = false;
    let lastPatchedWidth = 0;

    function applyPdfMetrics(force = false) {
      const mountHost = mountRef.current;
      if (!mountHost?.querySelector(`[${PDF_PAGE_CANVAS_ATTR}]`)) {
        return;
      }

      const width = resolvePdfContainerWidth(mountHost, scrollRef, fillCard);
      if (width <= 0 || (!force && width === lastPatchedWidth)) {
        return;
      }

      lastPatchedWidth = width;
      patchPdfMetrics(mountHost, width, { fillCard, firstPageOnly });
    }

    function stopResizeLoop() {
      isActivelyResizing = false;
      if (resizeLoopId !== null) {
        cancelAnimationFrame(resizeLoopId);
        resizeLoopId = null;
      }
    }

    function resizeLoopTick() {
      applyPdfMetrics();
      if (isActivelyResizing) {
        resizeLoopId = requestAnimationFrame(resizeLoopTick);
      } else {
        resizeLoopId = null;
      }
    }

    function scheduleResizeUpdate() {
      isActivelyResizing = true;

      if (resizeEndTimer) {
        clearTimeout(resizeEndTimer);
      }
      resizeEndTimer = setTimeout(() => {
        stopResizeLoop();
        applyPdfMetrics(true);
      }, 100);

      if (resizeLoopId === null) {
        resizeLoopId = requestAnimationFrame(resizeLoopTick);
      }
    }

    resizeObserver = new ResizeObserver(() => {
      scheduleResizeUpdate();
    });

    const observeTargets = [scrollRef.current, mountRef.current].filter(
      Boolean
    ) as HTMLElement[];
    for (const target of observeTargets) {
      resizeObserver.observe(target);
    }

    applyPdfMetrics(true);

    return () => {
      stopResizeLoop();
      if (resizeEndTimer) {
        clearTimeout(resizeEndTimer);
      }
      resizeObserver?.disconnect();
    };
  }, [mountRef, scrollRef, enabled, fillCard, firstPageOnly]);
}

function resolvePdfRenderWidth(
  scrollHost: HTMLElement | null,
  mount: HTMLElement
) {
  const currentWidth = resolvePreviewLayoutWidth(mount, scrollHost);
  const mobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;
  const maxWidth = resolveMaxPreviewLayoutWidth(scrollHost, { mobile });
  return Math.max(currentWidth, maxWidth);
}

function resolvePdfRenderScale(
  scrollHost: HTMLElement | null,
  mount: HTMLElement,
  pageWidth: number
) {
  const renderWidth = resolvePdfRenderWidth(scrollHost, mount);
  return previewPanelFillScale(renderWidth, pageWidth);
}

async function renderPdfPages(
  mount: HTMLElement,
  pdf: PDFDocumentProxy,
  scrollHost: HTMLElement | null,
  options?: {
    firstPageOnly?: boolean;
    showPageBadges?: boolean;
    fillCard?: boolean;
    /** Thumbnail/card: render for the card width only. */
    cardWidth?: number;
  }
) {
  mount.replaceChildren();
  const textLayers: PdfTextLayer[] = [];

  const pagesToRender = options?.firstPageOnly ? 1 : pdf.numPages;

  for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const pageWidth = page.getViewport({ scale: 1 }).width;
    const renderScale = options?.fillCard
      ? previewPanelFillScale(options.cardWidth ?? mount.clientWidth, pageWidth)
      : resolvePdfRenderScale(scrollHost, mount, pageWidth);

    const pageItem = document.createElement("div");
    pageItem.setAttribute(PDF_PAGE_INDEX_ATTR, String(pageNumber - 1));
    pageItem.dataset.pdfPageIndex = String(pageNumber - 1);
    pageItem.className = cn(
      options?.firstPageOnly
        ? "relative size-full min-w-0"
        : "relative mx-auto mb-6 last:mb-0"
    );

    const wrapper = document.createElement("div");
    wrapper.setAttribute(PDF_PAGE_WRAPPER_ATTR, "true");
    wrapper.className = "relative overflow-hidden";

    const scaleHost = document.createElement("div");
    scaleHost.setAttribute(PDF_SCALE_HOST_ATTR, "true");
    scaleHost.className = "relative origin-top-left";

    const canvas = document.createElement("canvas");
    canvas.setAttribute(PDF_PAGE_CANVAS_ATTR, "true");
    canvas.className = cn(
      "block bg-white",
      options?.firstPageOnly
        ? ""
        : "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]"
    );

    scaleHost.append(canvas);
    wrapper.append(scaleHost);
    pageItem.append(wrapper);
    mount.append(pageItem);

    await renderPdfPageCanvas(page, canvas, renderScale);

    if (!options?.firstPageOnly) {
      const textLayerContainer = document.createElement("div");
      textLayerContainer.className = "textLayer";
      scaleHost.append(textLayerContainer);
      textLayers.push(await renderPdfPageTextLayer(page, textLayerContainer));
    }

    if (options?.showPageBadges) {
      decoratePdfPageBadge(pageItem, pageNumber, pdf.numPages);
    }
  }

  return textLayers;
}

export function LibraryPdfPreview({ url }: { url: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rendered, setRendered] = useState(false);

  usePdfResizeLoop(mountRef, scrollRef, rendered);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let cancelled = false;
    let pdf: PDFDocumentProxy | null = null;
    let textLayers: PdfTextLayer[] = [];

    async function loadPreview() {
      setIsLoading(true);
      setError(null);
      setRendered(false);

      const mountHost = mountRef.current;
      if (!mountHost) {
        return;
      }

      await waitForLayoutWidth(mountHost);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      if (cancelled || !mountRef.current || mountRef.current.clientWidth <= 0) {
        return;
      }

      try {
        pdf = await fetchPdfDocument(url);
        if (cancelled || !mountRef.current) {
          return;
        }

        textLayers = await renderPdfPages(
          mountRef.current,
          pdf,
          scrollRef.current,
          { showPageBadges: true }
        );
        if (cancelled || !mountRef.current) {
          return;
        }

        patchPdfMetrics(
          mountRef.current,
          resolvePreviewLayoutWidth(mountRef.current, scrollRef.current)
        );
        setRendered(true);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not preview this PDF.");
          setIsLoading(false);
        }
      }
    }

    loadPreview().catch(() => {
      if (!cancelled) {
        setError("Could not preview this PDF.");
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      setRendered(false);
      for (const textLayer of textLayers) {
        textLayer.cancel();
      }
      pdf?.destroy();
      mount.replaceChildren();
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <Loader2Icon
            aria-hidden
            className="size-6 animate-spin text-muted-foreground"
          />
        </div>
      ) : null}
      <div
        className="box-border min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-5 sm:py-6"
        ref={scrollRef}
      >
        <div
          className="flex w-full min-w-0 flex-col items-center select-text"
          ref={mountRef}
        />
      </div>
    </div>
  );
}

export function LibraryPdfThumbnail({ url }: { url: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rendered, setRendered] = useState(false);

  usePdfResizeLoop(mountRef, mountRef, rendered, {
    fillCard: true,
    firstPageOnly: true,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let cancelled = false;
    let pdf: PDFDocumentProxy | null = null;

    async function loadThumbnail() {
      setIsLoading(true);
      setError(null);
      setRendered(false);

      const mountHost = mountRef.current;
      if (!mountHost) {
        return;
      }

      await waitForLayoutWidth(mountHost);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      if (cancelled || !mountRef.current || mountRef.current.clientWidth <= 0) {
        return;
      }

      try {
        pdf = await fetchPdfDocument(url);
        if (cancelled || !mountRef.current) {
          return;
        }

        const cardWidth = mountRef.current.clientWidth;
        await renderPdfPages(mountRef.current, pdf, null, {
          cardWidth,
          fillCard: true,
          firstPageOnly: true,
        });
        if (cancelled || !mountRef.current) {
          return;
        }

        patchPdfMetrics(mountRef.current, cardWidth, {
          fillCard: true,
          firstPageOnly: true,
        });
        setRendered(true);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not preview this PDF.");
          setIsLoading(false);
        }
      }
    }

    loadThumbnail().catch(() => {
      if (!cancelled) {
        setError("Could not preview this PDF.");
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      setRendered(false);
      pdf?.destroy();
      mount.replaceChildren();
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex size-full items-center justify-center bg-white p-4 text-center text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-b-lg bg-white">
      {isLoading ? (
        <div className="flex size-full items-center justify-center bg-white">
          <Loader2Icon
            aria-hidden
            className="size-5 animate-spin text-muted-foreground"
          />
        </div>
      ) : null}
      <div className="size-full min-w-0 overflow-hidden" ref={mountRef} />
    </div>
  );
}
