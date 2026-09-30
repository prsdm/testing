import type { KbCatalogRow } from "@/shared/sources/source-catalog-types";
import { KB_SOURCE_FILTER_OPTIONS } from "@/shared/sources/source-item-status";
import type { SourceConnectorType } from "@/shared/sources/source-types";

export type KbCatalogDetailItem = {
  label: string;
  value: string;
};

function formatKbDetailDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sourceLabel(sourceType: SourceConnectorType) {
  return (
    KB_SOURCE_FILTER_OPTIONS.find((option) => option.value === sourceType)
      ?.label ?? sourceType
  );
}

function formatDriveMimeType(mimeType: string) {
  const labels: Record<string, string> = {
    "application/json": "JSON",
    "application/msword": "Word document",
    "application/pdf": "PDF",
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.drawing": "Google Drawing",
    "application/vnd.google-apps.form": "Google Form",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.ms-excel": "Excel spreadsheet",
    "application/vnd.ms-powerpoint": "PowerPoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "PowerPoint",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "Excel spreadsheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "Word document",
    "image/gif": "GIF image",
    "image/jpeg": "JPEG image",
    "image/png": "PNG image",
    "image/webp": "WebP image",
    "text/csv": "CSV",
    "text/html": "HTML",
    "text/markdown": "Markdown",
    "text/plain": "Text file",
  };
  if (labels[mimeType]) {
    return labels[mimeType];
  }
  if (mimeType.startsWith("image/")) {
    return "Image";
  }
  if (mimeType.startsWith("video/")) {
    return "Video";
  }
  if (mimeType.startsWith("audio/")) {
    return "Audio";
  }
  const subtype = mimeType.split("/").at(1);
  return subtype ?? mimeType;
}

function formatDriveLocation(isSharedDrive: boolean | null | undefined) {
  if (isSharedDrive === true) {
    return "Shared drive";
  }
  if (isSharedDrive === false) {
    return "My Drive";
  }
  return null;
}

function indexedByLabel(row: KbCatalogRow, viewerUserId: string) {
  if (row.status === "not_indexed") {
    return "—";
  }
  if (row.createdByUserId === viewerUserId) {
    return "You";
  }
  const name = row.indexedByName?.trim();
  if (name) {
    return name;
  }
  const email = row.indexedByEmail?.trim();
  if (email) {
    return email.split("@")[0] ?? email;
  }
  return "—";
}

function pushDetail(
  details: KbCatalogDetailItem[],
  label: string,
  value: string | null | undefined
) {
  if (!value?.trim()) {
    return;
  }
  details.push({ label, value: value.trim() });
}

export function buildKbCatalogRowDetails(
  row: KbCatalogRow,
  viewerUserId: string
): KbCatalogDetailItem[] {
  const details: KbCatalogDetailItem[] = [];

  pushDetail(details, "Source", sourceLabel(row.sourceType));

  if (row.sourceType === "confluence") {
    pushDetail(details, "Space", row.confluenceSpaceName);
    if (
      row.confluenceSpaceKey &&
      row.confluenceSpaceKey !== row.confluenceSpaceName
    ) {
      pushDetail(details, "Space key", row.confluenceSpaceKey);
    }
  }

  if (row.sourceType === "notion") {
    pushDetail(details, "Workspace", row.notionWorkspaceName);
    pushDetail(
      details,
      "Type",
      row.notionKind === "database" ? "Database" : "Page"
    );
    if (row.notionIndexedRowCount && row.notionIndexedRowCount > 0) {
      pushDetail(details, "Indexed rows", String(row.notionIndexedRowCount));
    }
  }

  if (row.sourceType === "drive") {
    pushDetail(
      details,
      "Location",
      formatDriveLocation(row.driveIsSharedDrive)
    );
    if (row.driveMimeType) {
      pushDetail(details, "File type", formatDriveMimeType(row.driveMimeType));
    }
  }

  if (row.sourceType === "sharepoint") {
    pushDetail(details, "Site", row.sharePointSiteName);
  }

  if (row.sourceType === "slack") {
    pushDetail(
      details,
      "Visibility",
      row.slackIsPrivate ? "Private channel" : "Public channel"
    );
  }

  if (row.sourceType === "manual") {
    pushDetail(details, "Type", "Note");
  }

  if (row.sourceType === "upload") {
    pushDetail(details, "Type", "Uploaded file");
  }

  details.push({
    label: "Source updated",
    value: formatKbDetailDateTime(row.modifiedAt),
  });

  if (row.createdAt) {
    details.push({
      label: "Added to Kimi",
      value: formatKbDetailDateTime(row.createdAt),
    });
  }

  details.push({
    label: "Last indexed",
    value: formatKbDetailDateTime(row.lastIndexedAt),
  });

  details.push({
    label: "Indexed by",
    value: indexedByLabel(row, viewerUserId),
  });

  return details;
}
