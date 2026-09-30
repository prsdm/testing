"use client";

import { Loader2Icon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { previewPanelFillScale } from "@/lib/library/library-preview-layout";
import { cn } from "@/shared/utils";

const DOCX_RENDER_OPTIONS = {
  breakPages: true,
  className: "docx",
  ignoreLastRenderedPageBreak: true,
  inWrapper: false,
  renderFooters: true,
  renderHeaders: true,
  trimXmlDeclaration: true,
} as const;

const DOCX_PAGE_CLASS =
  "[&_section.docx]:bg-white [&_section.docx]:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]";

const DOCX_PAGE_BADGE_ATTR = "data-docx-page-badge";
const DOCX_PAGE_BADGES_LAYER_ATTR = "data-docx-page-badges";

const DOCX_PAGE_BADGE_CLASS =
  "pointer-events-none absolute z-10 w-max whitespace-nowrap rounded-sm bg-black/75 px-2 py-1 font-medium text-[11px] text-white tabular-nums sm:px-2.5 sm:text-xs";

function syncDocxPageBadges(mount: HTMLElement, enabled: boolean) {
  mount.querySelector(`[${DOCX_PAGE_BADGES_LAYER_ATTR}]`)?.remove();

  if (!enabled) {
    return;
  }

  const host = mount.querySelector<HTMLElement>("[data-docx-scale-host]");
  if (!host) {
    return;
  }

  const pages = [...host.querySelectorAll<HTMLElement>("section.docx")].filter(
    (page) => page.style.display !== "none"
  );
  if (pages.length === 0) {
    return;
  }

  const layer = document.createElement("div");
  layer.setAttribute(DOCX_PAGE_BADGES_LAYER_ATTR, "true");
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.overflow = "hidden";

  const mountRect = mount.getBoundingClientRect();

  for (const [index, page] of pages.entries()) {
    const pageRect = page.getBoundingClientRect();
    const badge = document.createElement("div");
    badge.setAttribute(DOCX_PAGE_BADGE_ATTR, "true");
    badge.className = DOCX_PAGE_BADGE_CLASS;
    badge.textContent = `Page ${index + 1} / ${pages.length}`;
    badge.style.left = `${pageRect.right - mountRect.left}px`;
    badge.style.top = `${pageRect.bottom - mountRect.top}px`;
    badge.style.transform = "translate(calc(-100% - 8px), calc(-100% - 8px))";
    layer.append(badge);
  }

  mount.style.position = "relative";
  mount.append(layer);
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

function resolveLayoutWidth(
  mount: HTMLElement,
  scrollHost?: HTMLElement | null
) {
  if (scrollHost) {
    const style = getComputedStyle(scrollHost);
    const padX =
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight);
    const width = scrollHost.clientWidth - padX;
    if (width > 0) {
      return width;
    }
  }

  return mount.getBoundingClientRect().width || mount.clientWidth;
}

function ensureDocxLayout(mount: HTMLElement, centered = true) {
  let clip = mount.querySelector<HTMLElement>("[data-docx-clip]");
  let host = mount.querySelector<HTMLElement>("[data-docx-scale-host]");

  if (!clip) {
    clip = document.createElement("div");
    clip.dataset.docxClip = "true";
    clip.style.overflow = "hidden";
    clip.style.position = "relative";
    clip.style.maxWidth = "100%";
    mount.append(clip);
  }

  if (centered) {
    clip.style.marginLeft = "auto";
    clip.style.marginRight = "auto";
  } else {
    clip.style.marginLeft = "0";
    clip.style.marginRight = "0";
  }

  if (!host) {
    host = document.createElement("div");
    host.dataset.docxScaleHost = "true";
    host.style.transformOrigin = "top left";
    host.style.position = "absolute";
    host.style.top = "0";
    host.style.left = "0";
    for (const section of [...mount.querySelectorAll("section.docx")]) {
      host.append(section);
    }
    clip.append(host);
  } else if (host.parentElement !== clip) {
    clip.append(host);
  }

  return { clip, host };
}

function visiblePages(host: HTMLElement, firstPageOnly?: boolean) {
  const pages = [...host.querySelectorAll<HTMLElement>("section.docx")];
  for (const [index, page] of pages.entries()) {
    page.style.display = firstPageOnly && index > 0 ? "none" : "";
    page.style.marginBottom =
      !firstPageOnly && index < pages.length - 1 ? "16px" : "0";
    page.style.maxWidth = "none";
    // Keep docx-preview's inline page width (Letter/A4) — clearing it collapses the page.
  }
  return pages.filter((page) => page.style.display !== "none");
}

function pageStackHeight(pages: HTMLElement[]) {
  return pages.reduce(
    (sum, page, index) =>
      sum +
      (page.offsetHeight || page.getBoundingClientRect().height) +
      (index > 0 ? 16 : 0),
    0
  );
}

function parseCssLengthPx(value: string): number | null {
  if (!value) {
    return null;
  }
  if (value.endsWith("px")) {
    return Number.parseFloat(value);
  }
  if (value.endsWith("pt")) {
    return Number.parseFloat(value) * (96 / 72);
  }
  if (value.endsWith("in")) {
    return Number.parseFloat(value) * 96;
  }
  return null;
}

/** US Letter width at 96dpi — docx-preview's usual default when pgSz is present. */
const DEFAULT_PAGE_WIDTH_PX = 816;

function readPageWidthPx(page: HTMLElement): number {
  const inlineWidth = parseCssLengthPx(page.style.width);
  if (inlineWidth && inlineWidth >= 400) {
    return inlineWidth;
  }

  const attrMatch = page
    .getAttribute("style")
    ?.match(/(?:^|;)\s*width:\s*([\d.]+)(px|pt|in)\b/i);
  if (attrMatch) {
    const fromAttr = parseCssLengthPx(`${attrMatch[1]}${attrMatch[2]}`);
    if (fromAttr && fromAttr >= 400) {
      return fromAttr;
    }
  }

  const computedWidth = parseCssLengthPx(getComputedStyle(page).width);
  if (computedWidth && computedWidth >= 400) {
    return computedWidth;
  }

  return DEFAULT_PAGE_WIDTH_PX;
}

function measurePageWidth(pages: HTMLElement[]) {
  if (pages.length === 0) {
    return DEFAULT_PAGE_WIDTH_PX;
  }
  return readPageWidthPx(pages[0]);
}

function enforcePageWidths(pages: HTMLElement[], pageWidth: number) {
  for (const page of pages) {
    page.style.width = `${pageWidth}px`;
    page.style.maxWidth = "none";
    page.style.flexShrink = "0";
  }
}

function patchDocxMetrics(
  mount: HTMLElement,
  layoutWidth: number,
  options?: {
    firstPageOnly?: boolean;
    contain?: boolean;
    fillCard?: boolean;
    /** Full panel — uniform scale to container width, preserve page aspect ratio. */
    standardPages?: boolean;
    /** Overlay page X / Y badges (panel preview only). */
    showPageBadges?: boolean;
  }
): number {
  const fillCard = options?.fillCard ?? false;
  const standardPages = options?.standardPages ?? false;
  const showPageBadges = options?.showPageBadges ?? false;
  const { clip, host } = ensureDocxLayout(mount, !fillCard);
  const pages = visiblePages(host, options?.firstPageOnly);
  const firstPage = pages[0];
  if (!firstPage) {
    return 0;
  }

  const containerWidth =
    layoutWidth > 0 ? layoutWidth : resolveLayoutWidth(mount);
  const pageWidth = measurePageWidth(pages);
  if (!(containerWidth && pageWidth)) {
    return 0;
  }

  enforcePageWidths(pages, pageWidth);

  let scale = previewPanelFillScale(containerWidth, pageWidth);

  const perPageHeights = pages.map(
    (page) => page.offsetHeight || page.getBoundingClientRect().height
  );
  const naturalHeight = pageStackHeight(pages);

  if (options?.contain && mount.clientHeight > 0 && naturalHeight > 0) {
    scale = Math.min(scale, mount.clientHeight / naturalHeight);
  }

  const displayWidth = fillCard
    ? containerWidth
    : standardPages
      ? containerWidth
      : scale < 1
        ? containerWidth
        : pageWidth;
  const displayHeight = fillCard
    ? mount.clientHeight
    : standardPages
      ? perPageHeights.reduce(
          (sum, height, index) => sum + height * scale + (index > 0 ? 16 : 0),
          0
        )
      : naturalHeight * scale;

  clip.style.width =
    fillCard || standardPages ? "100%" : `${Math.ceil(displayWidth)}px`;
  clip.style.maxWidth = "100%";
  clip.style.height = fillCard ? "100%" : `${Math.ceil(displayHeight)}px`;

  host.style.width = `${pageWidth}px`;
  host.style.transform = `scale(${scale})`;
  host.style.transformOrigin = "top left";

  const effectiveWidth = pageWidth * scale;
  host.style.left = `${Math.max(0, (containerWidth - effectiveWidth) / 2)}px`;

  mount.style.width = "100%";
  mount.style.maxWidth = "100%";
  mount.style.height = fillCard ? "100%" : `${Math.ceil(displayHeight)}px`;
  mount.style.overflow = "hidden";

  syncDocxPageBadges(
    mount,
    showPageBadges && !fillCard && !options?.firstPageOnly
  );

  return containerWidth;
}

async function fetchDocxBuffer(url: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to load document.");
  }
  return response.arrayBuffer();
}

async function renderDocxToMount(mount: HTMLElement, buffer: ArrayBuffer) {
  const { renderAsync } = await import("docx-preview");
  mount.innerHTML = "";
  mount.style.height = "";
  mount.style.overflow = "";
  mount.style.width = "";
  mount.style.maxWidth = "";
  await renderAsync(buffer, mount, mount, DOCX_RENDER_OPTIONS);
}

function useDocxResizeLoop(
  mountRef: RefObject<HTMLDivElement | null>,
  scrollRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  options?: {
    firstPageOnly?: boolean;
    contain?: boolean;
    fillCard?: boolean;
    standardPages?: boolean;
    showPageBadges?: boolean;
  }
) {
  const firstPageOnly = options?.firstPageOnly ?? false;
  const contain = options?.contain ?? false;
  const fillCard = options?.fillCard ?? false;
  const standardPages = options?.standardPages ?? false;
  const showPageBadges = options?.showPageBadges ?? false;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let resizeLoopId: number | null = null;
    let resizeEndTimer: ReturnType<typeof setTimeout> | null = null;
    let isActivelyResizing = false;
    let lastPatchedWidth = 0;

    function applyDocxMetrics(force = false) {
      const mountHost = mountRef.current;
      if (!mountHost?.querySelector("section.docx")) {
        return;
      }

      const layoutWidth = resolveLayoutWidth(mountHost, scrollRef.current);
      if (layoutWidth <= 0 || (!force && layoutWidth === lastPatchedWidth)) {
        return;
      }

      lastPatchedWidth = patchDocxMetrics(mountHost, layoutWidth, {
        contain,
        fillCard,
        firstPageOnly,
        showPageBadges,
        standardPages,
      });
    }

    function stopResizeLoop() {
      isActivelyResizing = false;
      if (resizeLoopId !== null) {
        cancelAnimationFrame(resizeLoopId);
        resizeLoopId = null;
      }
    }

    function resizeLoopTick() {
      applyDocxMetrics();
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
        applyDocxMetrics(true);
      }, 100);

      if (resizeLoopId === null) {
        resizeLoopId = requestAnimationFrame(resizeLoopTick);
      }
    }

    resizeObserver = new ResizeObserver(() => {
      scheduleResizeUpdate();
    });

    const observeTargets = [mountRef.current, scrollRef.current].filter(
      Boolean
    ) as HTMLElement[];
    for (const target of observeTargets) {
      resizeObserver.observe(target);
    }

    applyDocxMetrics(true);

    return () => {
      stopResizeLoop();
      if (resizeEndTimer) {
        clearTimeout(resizeEndTimer);
      }
      resizeObserver?.disconnect();
    };
  }, [
    contain,
    enabled,
    fillCard,
    firstPageOnly,
    mountRef,
    scrollRef,
    showPageBadges,
    standardPages,
  ]);
}

function scheduleDocxPatch(
  mountRef: RefObject<HTMLDivElement | null>,
  scrollRef: RefObject<HTMLDivElement | null>,
  options?: {
    firstPageOnly?: boolean;
    contain?: boolean;
    fillCard?: boolean;
    standardPages?: boolean;
    showPageBadges?: boolean;
  }
) {
  const run = () => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    const layoutWidth = resolveLayoutWidth(mount, scrollRef.current);
    patchDocxMetrics(mount, layoutWidth, options);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
  window.setTimeout(run, 150);
  window.setTimeout(run, 350);
}

export function LibraryDocxPreview({
  url,
}: {
  url: string;
  panelWidthPercent?: number;
  isResizing?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rendered, setRendered] = useState(false);

  useDocxResizeLoop(mountRef, scrollRef, rendered, {
    showPageBadges: true,
    standardPages: true,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let cancelled = false;

    async function loadDocument() {
      setIsLoading(true);
      setError(null);
      setRendered(false);

      const scrollHost = scrollRef.current;
      const layoutTarget = scrollHost ?? mountRef.current;
      if (!layoutTarget) {
        return;
      }

      await waitForLayoutWidth(layoutTarget);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      if (cancelled || !mountRef.current) {
        return;
      }

      try {
        const buffer = await fetchDocxBuffer(url);
        if (cancelled || !mountRef.current) {
          return;
        }

        await renderDocxToMount(mountRef.current, buffer);
        if (cancelled || !mountRef.current) {
          return;
        }

        scheduleDocxPatch(mountRef, scrollRef, {
          showPageBadges: true,
          standardPages: true,
        });
        setRendered(true);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not preview this document.");
          setIsLoading(false);
        }
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
      setRendered(false);
      if (mountRef.current) {
        mountRef.current.innerHTML = "";
        mountRef.current.style.height = "";
        mountRef.current.style.overflow = "";
        mountRef.current.style.width = "";
        mountRef.current.style.maxWidth = "";
      }
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
        className="box-border min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-5 sm:py-6"
        ref={scrollRef}
      >
        <div
          className={cn(
            "relative w-full max-w-full min-w-0 overflow-hidden",
            DOCX_PAGE_CLASS
          )}
          ref={mountRef}
        />
      </div>
    </div>
  );
}

export function LibraryDocxThumbnail({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rendered, setRendered] = useState(false);

  useDocxResizeLoop(containerRef, containerRef, rendered, {
    fillCard: true,
    firstPageOnly: true,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;

    async function loadThumbnail() {
      try {
        const layoutHost = containerRef.current;
        if (!layoutHost) {
          return;
        }

        await waitForLayoutWidth(layoutHost);
        const buffer = await fetchDocxBuffer(url);
        if (cancelled || !containerRef.current) {
          return;
        }

        await renderDocxToMount(containerRef.current, buffer);
        if (cancelled || !containerRef.current) {
          return;
        }

        scheduleDocxPatch(containerRef, containerRef, {
          fillCard: true,
          firstPageOnly: true,
        });
        setRendered(true);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadThumbnail();

    return () => {
      cancelled = true;
      setRendered(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        containerRef.current.style.height = "";
        containerRef.current.style.overflow = "";
        containerRef.current.style.width = "";
        containerRef.current.style.maxWidth = "";
      }
    };
  }, [url]);

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
      <div
        className={cn(
          "size-full min-w-0 overflow-hidden scheme-light",
          DOCX_PAGE_CLASS,
          "[&_section.docx]:rounded-none [&_section.docx]:shadow-none"
        )}
        ref={containerRef}
      />
    </div>
  );
}
