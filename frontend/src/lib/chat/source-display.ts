import type { SourceDocumentConnectorType } from "@/shared/search/citations";
import type { SearchResultSourceType } from "@/shared/search/types";

type SourceMetadataInput = {
  kind: "source" | "web" | "api";
  url?: string;
  sourceConnectorType?: SourceDocumentConnectorType;
  sourceType?: SearchResultSourceType;
};

const KB_SOURCE_LABELS: Record<SourceDocumentConnectorType, string> = {
  confluence: "Confluence",
  drive: "Google Drive",
  manual: "Sources",
  notion: "Notion",
  sharepoint: "SharePoint",
  slack: "Slack",
  upload: "Upload",
};

export function truncateSourceSnippet(text: string, maxLength = 200) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

export function getUrlHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {}
}

export function formatSourceDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getSourceMetadataLabel(source: SourceMetadataInput) {
  if (source.kind === "api") {
    return "Web search";
  }

  if (source.kind === "web") {
    if (source.url) {
      return getUrlHostname(source.url) ?? "Web";
    }
    return "Web";
  }

  if (source.sourceConnectorType) {
    return KB_SOURCE_LABELS[source.sourceConnectorType];
  }

  if (source.sourceType === "google_drive") {
    return "Google Drive";
  }
  if (source.sourceType === "personal_source") {
    return "Personal sources";
  }
  if (source.sourceType === "team_source") {
    return "Team sources";
  }
  if (source.sourceType === "slack") {
    return "Slack";
  }
  if (source.sourceType === "jira") {
    return "Jira";
  }
  if (source.sourceType === "gmail") {
    return "Gmail";
  }
  if (source.sourceType === "calendar") {
    return "Calendar";
  }

  return "Sources";
}

export function formatSourceMetadataLine(args: {
  updatedAt?: string;
  ageLabel?: string;
  metadataLabel?: string;
}) {
  const parts: string[] = [];
  const formattedDate = args.updatedAt
    ? formatSourceDate(args.updatedAt)
    : undefined;
  if (formattedDate) {
    parts.push(formattedDate);
  } else if (args.ageLabel) {
    parts.push(args.ageLabel);
  }
  if (args.metadataLabel) {
    parts.push(args.metadataLabel);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
