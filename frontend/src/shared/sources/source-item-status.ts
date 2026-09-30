import type { KbCatalogRow } from "@/shared/sources/source-catalog-types";
import type { SourceConnectorType } from "@/shared/sources/source-types";

const CONNECTOR_SOURCE_TYPES = new Set<SourceConnectorType>([
  "drive",
  "confluence",
  "notion",
  "sharepoint",
  "slack",
]);

export type KbIndexStatus =
  | "not_indexed"
  | "indexed"
  | "update_available"
  | "added";

function toMillis(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Detect connector source changes using the indexed snapshot and index time. */
export function getConnectorSourceIndexStatus(item: {
  sourceType: SourceConnectorType;
  liveModifiedAt?: string | null;
  indexedSourceUpdatedAt?: string | null;
  lastIndexedAt?: string | null;
  status?: KbIndexStatus;
}): KbIndexStatus {
  if (item.status) {
    return item.status;
  }

  if (!CONNECTOR_SOURCE_TYPES.has(item.sourceType)) {
    return "added";
  }

  const liveModifiedMillis = toMillis(item.liveModifiedAt);
  const indexedSnapshotMillis = toMillis(item.indexedSourceUpdatedAt);
  const lastIndexedMillis = toMillis(item.lastIndexedAt);

  if (
    liveModifiedMillis > 0 &&
    indexedSnapshotMillis > 0 &&
    liveModifiedMillis > indexedSnapshotMillis
  ) {
    return "update_available";
  }

  if (
    liveModifiedMillis > 0 &&
    lastIndexedMillis > 0 &&
    liveModifiedMillis > lastIndexedMillis
  ) {
    return "update_available";
  }

  return "indexed";
}

export function getKbItemIndexStatus(item: {
  sourceType: SourceConnectorType;
  sourceUpdatedAt?: string | null;
  lastIndexedAt?: string | null;
  status?: KbIndexStatus;
}): KbIndexStatus {
  if (item.status) {
    return item.status;
  }

  if (!CONNECTOR_SOURCE_TYPES.has(item.sourceType)) {
    return "added";
  }

  const sourceModifiedMillis = toMillis(item.sourceUpdatedAt);
  const indexedSourceMillis = toMillis(item.lastIndexedAt);
  if (
    sourceModifiedMillis > 0 &&
    indexedSourceMillis > 0 &&
    sourceModifiedMillis > indexedSourceMillis
  ) {
    return "update_available";
  }

  return "indexed";
}

export function getKbItemStatusLabel(status: KbIndexStatus) {
  switch (status) {
    case "not_indexed":
      return "Not indexed";
    case "update_available":
      return "Update available";
    case "indexed":
      return "Indexed";
    case "added":
      return "Added";
    default:
      return "—";
  }
}

const KB_CATALOG_STATUS_SORT_ORDER: Record<KbIndexStatus, number> = {
  added: 2,
  indexed: 1,
  not_indexed: 3,
  update_available: 0,
};

export function compareKbCatalogRowsByIndexStatus(
  left: {
    sourceType: SourceConnectorType;
    modifiedAt?: string | null;
    lastIndexedAt?: string | null;
    status?: KbIndexStatus;
  },
  right: {
    sourceType: SourceConnectorType;
    modifiedAt?: string | null;
    lastIndexedAt?: string | null;
    status?: KbIndexStatus;
  }
) {
  const leftStatus = getKbItemIndexStatus({
    lastIndexedAt: left.lastIndexedAt,
    sourceType: left.sourceType,
    sourceUpdatedAt: left.modifiedAt,
    status: left.status,
  });
  const rightStatus = getKbItemIndexStatus({
    lastIndexedAt: right.lastIndexedAt,
    sourceType: right.sourceType,
    sourceUpdatedAt: right.modifiedAt,
    status: right.status,
  });
  const statusDiff =
    KB_CATALOG_STATUS_SORT_ORDER[leftStatus] -
    KB_CATALOG_STATUS_SORT_ORDER[rightStatus];
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const leftTime =
    leftStatus === "not_indexed"
      ? toMillis(left.modifiedAt)
      : toMillis(left.lastIndexedAt ?? left.modifiedAt);
  const rightTime =
    rightStatus === "not_indexed"
      ? toMillis(right.modifiedAt)
      : toMillis(right.lastIndexedAt ?? right.modifiedAt);
  return rightTime - leftTime;
}

export const KB_SOURCE_FILTER_OPTIONS: Array<{
  value: SourceConnectorType;
  label: string;
}> = [
  { label: "Drive", value: "drive" },
  { label: "Confluence", value: "confluence" },
  { label: "Notion", value: "notion" },
  { label: "SharePoint", value: "sharepoint" },
  { label: "Slack", value: "slack" },
  { label: "Upload", value: "upload" },
  { label: "Note", value: "manual" },
];

export function formatKbTableDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatKbCatalogRowTitle(row: KbCatalogRow) {
  if (
    row.notionKind === "database" &&
    row.notionIndexedRowCount &&
    row.notionIndexedRowCount > 0
  ) {
    const rowLabel = row.notionIndexedRowCount === 1 ? "row" : "rows";
    return `${row.title} · ${row.notionIndexedRowCount} ${rowLabel}`;
  }
  if (row.sourceType === "slack" && row.slackIsPrivate) {
    return `${row.title} · private`;
  }
  return row.title;
}
