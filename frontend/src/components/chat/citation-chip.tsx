"use client";

import { format } from "date-fns";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { normalizeAtlassianSourceLink } from "@/shared/connectors/providers/confluence/url";
import type { CitedDocument } from "@/shared/search/citations";
import { getCitationBadgeKind } from "@/shared/search/citations";
import { cn } from "@/shared/utils";
import { SourceBadgeIcon } from "./source-badge-icon";

const CHIP_CLASSNAME =
  "mx-0.5 inline-flex h-[22px] max-w-[5rem] items-center gap-1 rounded-md bg-muted/70 px-2 align-middle text-[11px] font-normal text-muted-foreground leading-none transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground dark:bg-[#2f2f2f] dark:text-[#d9d9d9] dark:hover:bg-[#424242] dark:hover:text-white";

function capitalizeWord(value: string) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Short inline label for the pill — brand-like for web, title for KB. */
function shortCitationLabel(document: CitedDocument): string {
  const title = document.title?.trim();

  if (document.sourceType === "web") {
    if (title && title.length <= 24) {
      return title;
    }
    if (document.link) {
      try {
        const hostname = new URL(document.link).hostname.replace(/^www\./, "");
        const stem = hostname.split(".")[0];
        if (stem) {
          return capitalizeWord(stem);
        }
      } catch {
        // Fall through to title.
      }
    }
  }

  if (title) {
    return title.length > 28 ? `${title.slice(0, 25)}...` : title;
  }

  return "Source";
}

function formatCitationDate(updatedAt?: string) {
  if (!updatedAt) {
    return;
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return;
  }

  return format(date, "d MMMM yyyy");
}

function citationPreviewText(document: CitedDocument) {
  const text = document.blurb?.trim() || document.content?.trim();
  if (!text) {
    return;
  }

  if (text.length <= 200) {
    return text;
  }

  return `${text.slice(0, 197).trimEnd()}...`;
}

function CitationSourceMark({
  document,
  className,
}: {
  document: CitedDocument;
  className?: string;
}) {
  return (
    <SourceBadgeIcon
      className={cn("size-3 shrink-0", className)}
      imageClassName="size-3"
      source={{
        kind: getCitationBadgeKind(document),
        sourceConnectorType: document.sourceConnectorType,
        sourceType:
          document.sourceType === "web" ? undefined : document.sourceType,
        url: document.link,
      }}
    />
  );
}

function CitationPreviewCard({ document }: { document: CitedDocument }) {
  const label = shortCitationLabel(document);
  const dateLabel = formatCitationDate(document.updatedAt);
  const previewText = citationPreviewText(document);
  const headline = document.title?.trim() || label;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <CitationSourceMark document={document} />
        <span className="truncate text-xs">{label}</span>
      </div>
      <p className="line-clamp-2 font-medium text-foreground text-sm leading-snug">
        {headline}
      </p>
      {dateLabel ? (
        <p className="text-muted-foreground text-xs">{dateLabel}</p>
      ) : null}
      {previewText ? (
        <p className="line-clamp-4 text-muted-foreground text-xs leading-relaxed">
          {previewText}
        </p>
      ) : null}
    </div>
  );
}

function CitationChipBody({
  document,
  className,
}: {
  document: CitedDocument;
  className?: string;
}) {
  const label = shortCitationLabel(document);

  return (
    <span className={cn(CHIP_CLASSNAME, className)}>
      <CitationSourceMark document={document} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function CitationChip({
  document,
  className,
}: {
  /** Retained for callers; the source title is shown instead of the number. */
  number?: number;
  document: CitedDocument;
  className?: string;
}) {
  const normalizedLink = document.link
    ? normalizeAtlassianSourceLink(document.link)
    : undefined;

  return (
    <HoverCard closeDelay={80} openDelay={200}>
      <HoverCardTrigger asChild>
        {normalizedLink ? (
          <a
            className="inline no-underline"
            href={normalizedLink}
            rel="noopener noreferrer"
            target="_blank"
          >
            <CitationChipBody className={className} document={document} />
          </a>
        ) : (
          <button
            className="inline cursor-default border-0 bg-transparent p-0"
            type="button"
          >
            <CitationChipBody className={className} document={document} />
          </button>
        )}
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-80 p-4"
        side="top"
        sideOffset={8}
      >
        <CitationPreviewCard document={document} />
      </HoverCardContent>
    </HoverCard>
  );
}
