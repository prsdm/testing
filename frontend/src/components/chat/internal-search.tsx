"use client";

import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import {
  extractKnowledgeSearchDocuments as extractKnowledgeSearchDocumentsFromLib,
  resolveSearchDisplayQueries,
} from "@/lib/chat/search-tool-display";
import { resolveConnectorProvider } from "@/lib/chat/source-provider";
import { normalizeAtlassianSourceLink } from "@/shared/connectors/providers/confluence/url";
import type {
  CitedDocument,
  InternalSearchToolOutput,
} from "@/shared/search/citations";
import { getCitationBadgeKind } from "@/shared/search/citations";
import { cn } from "@/shared/utils";
import { activityChipClassName } from "./activity-chip-list";
import { SourceBadgeIcon } from "./source-badge-icon";

function SourceProviderMark({
  source,
  className,
}: {
  source: CitedDocument;
  className?: string;
}) {
  const badgeKind = getCitationBadgeKind(source);
  const provider = resolveConnectorProvider({
    kind: badgeKind,
    sourceConnectorType: source.sourceConnectorType,
    sourceType: source.sourceType === "web" ? undefined : source.sourceType,
    url: source.link,
  });

  if (provider) {
    return (
      <ConnectorProviderIcon
        className={cn("size-3 shrink-0", className)}
        provider={provider}
      />
    );
  }

  return (
    <SourceBadgeIcon
      className={cn("size-3", className)}
      imageClassName="size-3"
      source={{
        kind: badgeKind,
        sourceConnectorType: source.sourceConnectorType,
        sourceType: source.sourceType === "web" ? undefined : source.sourceType,
        url: source.link,
      }}
    />
  );
}

export function extractKnowledgeSearchQueries(
  output?: InternalSearchToolOutput
): string[] {
  return resolveSearchDisplayQueries(undefined, output);
}

export function extractKnowledgeSearchDocuments(
  output?: InternalSearchToolOutput
): CitedDocument[] {
  return extractKnowledgeSearchDocumentsFromLib(output);
}

type KnowledgeDocumentChipProps = {
  document: CitedDocument;
};

export function KnowledgeDocumentChip({
  document,
}: KnowledgeDocumentChipProps) {
  const normalizedLink = document.link
    ? normalizeAtlassianSourceLink(document.link)
    : undefined;

  const chipContent = (
    <>
      <SourceProviderMark className="size-3" source={document} />
      <span className="max-w-40 truncate">{document.title || "Untitled"}</span>
    </>
  );

  if (normalizedLink) {
    return (
      <a
        className={cn(
          activityChipClassName,
          "max-w-full gap-1 transition-colors hover:bg-muted"
        )}
        href={normalizedLink}
        rel="noopener noreferrer"
        target="_blank"
        title={document.title}
      >
        {chipContent}
      </a>
    );
  }

  return (
    <span
      className={cn(activityChipClassName, "max-w-full gap-1")}
      title={document.title}
    >
      {chipContent}
    </span>
  );
}
