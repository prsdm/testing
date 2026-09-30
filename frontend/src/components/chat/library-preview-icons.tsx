"use client";

import { FileIcon, ImageIcon } from "lucide-react";
import Image from "next/image";
import {
  publicAssetUrl,
  SANDBOX_WORK_SKILL_LOGOS,
} from "@/shared/assets/public-asset-url";
import type { LibraryPreviewKind } from "@/shared/library/library-preview-kind";
import { cn } from "@/shared/utils";

const SLIDES_ICON_PATH = publicAssetUrl(SANDBOX_WORK_SKILL_LOGOS.slides);
const DOCS_ICON_PATH = publicAssetUrl(SANDBOX_WORK_SKILL_LOGOS.docs);
const SHEETS_ICON_PATH = publicAssetUrl(SANDBOX_WORK_SKILL_LOGOS.xlsx);
const PDF_ICON_PATH = publicAssetUrl(SANDBOX_WORK_SKILL_LOGOS.pdf);

function SlidesKindIcon({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const size = compact ? 16 : 24;

  return (
    <Image
      alt=""
      aria-hidden
      className={cn(
        "shrink-0 object-contain",
        compact ? "size-4" : "size-6",
        className
      )}
      height={size}
      src={SLIDES_ICON_PATH}
      unoptimized
      width={size}
    />
  );
}

function DocsKindIcon({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const size = compact ? 16 : 24;

  return (
    <Image
      alt=""
      aria-hidden
      className={cn(
        "shrink-0 object-contain",
        compact ? "size-4" : "size-6",
        className
      )}
      height={size}
      src={DOCS_ICON_PATH}
      unoptimized
      width={size}
    />
  );
}

function SheetKindIcon({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const size = compact ? 16 : 24;

  return (
    <Image
      alt=""
      aria-hidden
      className={cn(
        "shrink-0 object-contain",
        compact ? "size-4" : "size-6",
        className
      )}
      height={size}
      src={SHEETS_ICON_PATH}
      unoptimized
      width={size}
    />
  );
}

function PdfKindIcon({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const size = compact ? 16 : 24;

  return (
    <Image
      alt=""
      aria-hidden
      className={cn(
        "shrink-0 object-contain",
        compact ? "size-4" : "size-6",
        className
      )}
      height={size}
      src={PDF_ICON_PATH}
      unoptimized
      width={size}
    />
  );
}

export function LibraryPreviewKindIcon({
  kind,
  className,
  compact = false,
}: {
  kind: LibraryPreviewKind;
  className?: string;
  compact?: boolean;
}) {
  const iconClass = cn(compact ? "size-4" : "size-6", className);

  switch (kind) {
    case "sheet":
      return <SheetKindIcon className={iconClass} compact={compact} />;
    case "slides":
      return <SlidesKindIcon className={iconClass} compact={compact} />;
    case "text":
      return <DocsKindIcon className={iconClass} compact={compact} />;
    case "pdf":
      return <PdfKindIcon className={iconClass} compact={compact} />;
    case "image":
      return <ImageIcon aria-hidden className={iconClass} />;
    default:
      return <FileIcon aria-hidden className={iconClass} />;
  }
}
