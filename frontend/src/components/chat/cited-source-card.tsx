"use client";

import {
  formatSourceMetadataLine,
  truncateSourceSnippet,
} from "@/lib/chat/source-display";
import { cn } from "@/shared/utils";
import type { BottomSource } from "./message";
import { SourceBadgeIcon } from "./source-badge-icon";

function SourceCardBody({ source }: { source: BottomSource }) {
  const metadataLine = formatSourceMetadataLine({
    ageLabel: source.ageLabel,
    metadataLabel: source.metadataLabel,
    updatedAt: source.updatedAt,
  });
  const snippet = truncateSourceSnippet(source.snippet ?? "");

  return (
    <>
      <p className="line-clamp-2 font-medium text-foreground text-sm leading-snug">
        {source.title}
      </p>
      {metadataLine ? (
        <p className="mt-0.5 text-muted-foreground text-xs">{metadataLine}</p>
      ) : null}
      {snippet ? (
        <p className="mt-1.5 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
          {snippet}
        </p>
      ) : null}
    </>
  );
}

export function CitedSourceCard({
  source,
  className,
}: {
  source: BottomSource;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/40",
        className
      )}
    >
      <SourceBadgeIcon
        className="mt-0.5 size-4 shrink-0"
        imageClassName="size-4"
        source={source}
      />
      <div className="min-w-0 flex-1">
        {source.url ? (
          <a
            className="block min-w-0"
            href={source.url}
            rel="noopener noreferrer"
            target="_blank"
            title={source.title}
          >
            <SourceCardBody source={source} />
          </a>
        ) : (
          <SourceCardBody source={source} />
        )}
      </div>
    </div>
  );
}
