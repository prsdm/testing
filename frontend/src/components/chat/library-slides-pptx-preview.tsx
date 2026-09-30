"use client";

import { PptxViewer, RECOMMENDED_ZIP_LIMITS } from "@aiden0z/pptx-renderer";
import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  previewPanelFillScale,
  resolvePreviewLayoutWidth,
} from "@/lib/library/library-preview-layout";

const SLIDE_BADGE_ATTR = "data-slide-badge";

function getSlideListItem(slideElement: HTMLElement) {
  return slideElement.closest<HTMLElement>("[data-slide-index]");
}

function decorateSlideCard(
  slideElement: HTMLElement,
  page: number,
  total: number
) {
  const slideItem = getSlideListItem(slideElement);
  if (!slideItem || slideItem.dataset.decorated === "true") {
    return;
  }

  slideItem.dataset.decorated = "true";
  slideItem.classList.add(
    "relative",
    "mx-auto",
    "mb-6",
    "rounded-sm",
    "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]"
  );

  const badge = document.createElement("div");
  badge.setAttribute(SLIDE_BADGE_ATTR, "true");
  badge.className =
    "pointer-events-none absolute right-2 bottom-2 z-10 w-max whitespace-nowrap rounded-sm bg-black/75 px-2 py-1 font-medium text-[11px] text-white tabular-nums sm:right-3 sm:bottom-3 sm:px-2.5 sm:text-xs";
  badge.textContent = `Page ${page} / ${total}`;
  slideItem.appendChild(badge);
}

function updateSlideBadges(container: HTMLElement, total: number) {
  const items = container.querySelectorAll<HTMLElement>("[data-slide-index]");
  items.forEach((item, index) => {
    const badge = item.querySelector<HTMLElement>(`[${SLIDE_BADGE_ATTR}]`);
    if (badge) {
      badge.textContent = `Page ${index + 1} / ${total}`;
    }
  });
}

/** Re-sync one slide wrapper to the current container width. */
function patchSingleSlideMetrics(
  slideElement: HTMLElement,
  viewer: PptxViewer,
  containerWidth: number
) {
  const slideWidth = viewer.slideWidth;
  const slideHeight = viewer.slideHeight;
  if (!(containerWidth && slideWidth && slideHeight)) {
    return;
  }

  const wrapper = slideElement.parentElement;
  if (!(wrapper instanceof HTMLElement)) {
    return;
  }

  const scale = previewPanelFillScale(containerWidth, slideWidth);
  const displayWidth = slideWidth * scale;
  const displayHeight = slideHeight * scale;

  wrapper.style.width = `${displayWidth}px`;
  wrapper.style.height = `${displayHeight}px`;
  wrapper.style.willChange = "width, height";
  slideElement.style.transform = `scale(${scale})`;
  slideElement.style.transformOrigin = "top left";
  slideElement.style.willChange = "transform";

  const slideItem = slideElement.closest<HTMLElement>("[data-slide-index]");
  if (slideItem) {
    slideItem.style.width = `${displayWidth}px`;
    slideItem.style.marginLeft = "auto";
    slideItem.style.marginRight = "auto";
  }
}

/** Re-sync all slide wrapper dimensions when container width changes. */
function patchSlideMetrics(
  viewer: PptxViewer,
  mount: HTMLElement,
  containerWidth: number
) {
  if (containerWidth <= 0) {
    return;
  }

  for (const item of mount.querySelectorAll<HTMLElement>(
    "[data-slide-index]"
  )) {
    const slideEl = item.firstElementChild?.firstElementChild;
    if (slideEl instanceof HTMLElement) {
      patchSingleSlideMetrics(slideEl, viewer, containerWidth);
    }
  }
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

export function LibrarySlidesPptxPreview({ url }: { url: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const applyMetricsRef = useRef<((force?: boolean) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    const scroll = scrollRef.current;
    if (!(mount && scroll)) {
      return;
    }

    let viewer: PptxViewer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeLoopId: number | null = null;
    let resizeEndTimer: ReturnType<typeof setTimeout> | null = null;
    let isActivelyResizing = false;
    let lastPatchedWidth = 0;
    let cancelled = false;

    function applySlideMetrics(force = false) {
      const currentViewer = viewer;
      const mountHost = mountRef.current;
      if (!(currentViewer && mountHost)) {
        return;
      }

      const width = resolvePreviewLayoutWidth(mountHost, scrollRef.current);
      if (width <= 0 || (!force && width === lastPatchedWidth)) {
        return;
      }

      lastPatchedWidth = width;
      patchSlideMetrics(currentViewer, mountHost, width);
    }

    applyMetricsRef.current = (force = false) => {
      applySlideMetrics(force);
    };

    function stopResizeLoop() {
      isActivelyResizing = false;
      if (resizeLoopId !== null) {
        cancelAnimationFrame(resizeLoopId);
        resizeLoopId = null;
      }
    }

    function resizeLoopTick() {
      applySlideMetrics();
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
        applySlideMetrics(true);
      }, 100);

      if (resizeLoopId === null) {
        resizeLoopId = requestAnimationFrame(resizeLoopTick);
      }
    }

    async function loadPresentation() {
      setIsLoading(true);
      setError(null);

      const mountElement = mountRef.current;
      if (!mountElement) {
        return;
      }

      await waitForLayoutWidth(mountElement);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const mountHost = mountRef.current;
      const scrollHost = scrollRef.current;
      if (
        cancelled ||
        !(mountHost && scrollHost) ||
        mountHost.clientWidth <= 0
      ) {
        return;
      }

      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load presentation.");
      }

      const buffer = await response.arrayBuffer();
      if (cancelled || !mountRef.current) {
        return;
      }

      let slideTotal = 0;

      const initialWidth = mountHost.clientWidth;

      viewer = await PptxViewer.open(buffer, mountRef.current, {
        fitMode: "contain",
        lazyMedia: true,
        lazySlides: true,
        listOptions: {
          batchSize: 4,
          initialSlides: 4,
          showSlideLabels: false,
          windowed: true,
        },
        onRenderComplete: () => {
          applySlideMetrics(true);
          if (viewer && mountRef.current) {
            updateSlideBadges(mountRef.current, viewer.slideCount);
          }
        },
        onSlideRendered: (index, element) => {
          decorateSlideCard(element, index + 1, slideTotal);
          const mountNode = mountRef.current;
          if (viewer && mountNode) {
            patchSingleSlideMetrics(
              element,
              viewer,
              lastPatchedWidth || mountNode.clientWidth
            );
          }
        },
        scrollContainer: scrollHost,
        // Fixed width disables the viewer's full DOM rebuild on resize (causes flash).
        width: initialWidth,
        zipLimits: RECOMMENDED_ZIP_LIMITS,
      });

      slideTotal = viewer.slideCount;
      lastPatchedWidth = initialWidth;
      applySlideMetrics(true);
      updateSlideBadges(mountRef.current, slideTotal);

      resizeObserver = new ResizeObserver(() => {
        scheduleResizeUpdate();
      });
      const observeTarget = scrollRef.current ?? mountRef.current;
      if (observeTarget) {
        resizeObserver.observe(observeTarget);
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    loadPresentation().catch(() => {
      if (!cancelled) {
        setError("Failed to load presentation preview.");
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      applyMetricsRef.current = null;
      stopResizeLoop();
      if (resizeEndTimer) {
        clearTimeout(resizeEndTimer);
      }
      resizeObserver?.disconnect();
      viewer?.destroy();
      mount.innerHTML = "";
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
      {/* Padding on scroll shell only — mount node must be unpadded so clientWidth matches slide area */}
      <div
        className="box-border min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6"
        ref={scrollRef}
      >
        <div className="w-full min-w-0" ref={mountRef} />
      </div>
    </div>
  );
}

export function LibrarySlidePptxThumbnail({
  url,
  page,
  total,
}: {
  url: string;
  page: number;
  total: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) {
      return;
    }

    let viewer: PptxViewer | null = null;
    let slideHandle: { dispose: () => void } | null = null;
    let cancelled = false;

    async function loadThumbnail() {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load presentation.");
      }

      const buffer = await response.arrayBuffer();
      if (cancelled || !containerRef.current) {
        return;
      }

      const thumbnailHost = containerRef.current;
      const scratch = document.createElement("div");
      viewer = await PptxViewer.open(buffer, scratch, {
        renderMode: "slide",
        zipLimits: RECOMMENDED_ZIP_LIMITS,
      });

      const width = thumbnailHost.clientWidth || 480;
      slideHandle =
        viewer.renderThumbnailToContainer(0, thumbnailHost, { width }) ?? null;

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    loadThumbnail().catch(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      slideHandle?.dispose();
      viewer?.destroy();
      containerElement.innerHTML = "";
    };
  }, [url]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-b-lg bg-background">
      {isLoading ? (
        <div className="flex size-full items-center justify-center">
          <Loader2Icon
            aria-hidden
            className="size-5 animate-spin text-muted-foreground"
          />
        </div>
      ) : null}
      <div className="size-full min-w-0" ref={containerRef} />
      {total > 1 ? (
        <div className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-md bg-black/75 px-2 py-0.5 font-medium text-[11px] text-white tabular-nums">
          Page {page} / {total}
        </div>
      ) : null}
    </div>
  );
}
