import type { ConnectorProvider } from "@/contracts/connectors";
import type { SearchResultSourceType } from "@/shared/search/types";

export type SourceDocumentConnectorType =
  | "manual"
  | "drive"
  | "upload"
  | "confluence"
  | "notion"
  | "sharepoint"
  | "slack";

export type SourceBadgeInput = {
  kind: "source" | "web" | "api";
  url?: string;
  sourceConnectorType?: SourceDocumentConnectorType;
  sourceType?: SearchResultSourceType;
};

export function getSourceFaviconUrl(
  source: Pick<SourceBadgeInput, "url" | "kind">
) {
  if (!source.url || source.kind !== "web") {
    return;
  }
  try {
    const parsed = new URL(source.url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(parsed.hostname)}`;
  } catch {}
}

export function resolveConnectorProvider(
  source: SourceBadgeInput
): ConnectorProvider | null {
  if (source.kind === "web" || source.kind === "api") {
    return null;
  }

  if (source.sourceConnectorType === "drive") {
    return "google-drive";
  }
  if (source.sourceConnectorType === "confluence") {
    return "confluence";
  }
  if (source.sourceConnectorType === "notion") {
    return "notion";
  }
  if (source.sourceConnectorType === "sharepoint") {
    return "sharepoint";
  }
  if (source.sourceConnectorType === "slack") {
    return "slack";
  }
  if (source.sourceType === "google_drive") {
    return "google-drive";
  }
  if (source.sourceType === "slack") {
    return "slack";
  }
  if (source.sourceType === "jira") {
    return "jira";
  }
  if (source.sourceType === "gmail") {
    return "gmail";
  }
  if (source.sourceType === "calendar") {
    return "google-calendar";
  }

  if (!source.url) {
    return null;
  }

  try {
    const host = new URL(source.url).hostname.toLowerCase();
    if (host.includes("notion.")) {
      return "notion";
    }
    if (host.includes("slack.com")) {
      return "slack";
    }
    if (host === "mail.google.com" || host.endsWith(".googlemail.com")) {
      return "gmail";
    }
    if (
      host === "calendar.google.com" ||
      (host.endsWith(".google.com") &&
        source.url.toLowerCase().includes("calendar"))
    ) {
      return "google-calendar";
    }
    if (host.endsWith(".atlassian.net")) {
      if (source.url.toLowerCase().includes("/browse/")) {
        return "jira";
      }
      return "confluence";
    }
    if (host.includes("sharepoint.com")) {
      return "sharepoint";
    }
    if (
      host === "docs.google.com" ||
      host === "drive.google.com" ||
      host.endsWith(".google.com")
    ) {
      return "google-drive";
    }
  } catch {
    return null;
  }

  return null;
}
