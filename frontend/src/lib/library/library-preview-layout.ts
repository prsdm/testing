export const LIBRARY_PREVIEW_PANEL_DEFAULT_PERCENT = 30;
export const LIBRARY_PREVIEW_PANEL_MIN_PERCENT = 30;
export const LIBRARY_PREVIEW_PANEL_MAX_PERCENT = 50;

export const LIBRARY_PREVIEW_PANEL_WIDTH_STORAGE_KEY =
  "library-preview-panel-width-percent";

export function clampLibraryPreviewPanelWidth(percent: number) {
  return Math.min(
    LIBRARY_PREVIEW_PANEL_MAX_PERCENT,
    Math.max(LIBRARY_PREVIEW_PANEL_MIN_PERCENT, percent)
  );
}

/** Content width inside a padded scroll shell (matches docx/pdf panel layout). */
export function resolvePreviewLayoutWidth(
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

/** Max content width when the preview panel is at its widest (50% desktop, full mobile). */
export function resolveMaxPreviewLayoutWidth(
  scrollHost?: HTMLElement | null,
  options?: { mobile?: boolean }
) {
  if (typeof window === "undefined") {
    return 0;
  }

  let padX = 0;
  if (scrollHost) {
    const style = getComputedStyle(scrollHost);
    padX =
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight);
  }

  const panelFraction = options?.mobile
    ? 1
    : LIBRARY_PREVIEW_PANEL_MAX_PERCENT / 100;

  return Math.max(0, window.innerWidth * panelFraction - padX);
}

/** Vector panel previews (docx/ppt): fill panel width via CSS transform. */
export function previewPanelFillScale(
  containerWidth: number,
  contentWidth: number
) {
  if (!(containerWidth > 0 && contentWidth > 0)) {
    return 1;
  }
  return containerWidth / contentWidth;
}

/** @deprecated Use previewPanelFillScale for vector previews. */
export const previewPanelScale = previewPanelFillScale;
