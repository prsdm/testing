import type { SourceConnectorType } from "@/shared/sources/source-types";

export type KbCatalogStatus =
  | "not_indexed"
  | "indexed"
  | "update_available"
  | "added";

export type KbCatalogRow = {
  rowKey: string;
  title: string;
  sourceType: SourceConnectorType;
  externalRef: string;
  link: string | null;
  modifiedAt: string | null;
  status: KbCatalogStatus;
  kbItemId: string | null;
  lastIndexedAt: string | null;
  indexedByEmail: string | null;
  indexedByName: string | null;
  createdByUserId: string | null;
  createdAt?: string | null;
  notionKind?: "page" | "database";
  notionIndexedRowCount?: number;
  confluenceSpaceName?: string | null;
  confluenceSpaceKey?: string | null;
  driveMimeType?: string | null;
  driveIsSharedDrive?: boolean | null;
  notionWorkspaceName?: string | null;
  sharePointSiteName?: string | null;
  slackIsPrivate?: boolean | null;
};

export type KnowledgeConnectorPinFlags = {
  drivePinEnabled: boolean;
  confluencePinEnabled: boolean;
  notionPinEnabled: boolean;
  sharePointPinEnabled: boolean;
  slackPinEnabled: boolean;
};

export type KbCatalogResponse = {
  rows: KbCatalogRow[];
  connectors: KnowledgeConnectorPinFlags;
};
