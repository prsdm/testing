import { confluenceGetPage } from "@/core/lib/connectors/providers/confluence/api";
import { driveGetFileMetadata } from "@/core/lib/connectors/providers/google-drive/read";
import type {
  SourceConnectorType,
  TeamSourceListRow,
} from "@/core/lib/db/source-queries";
import { loadKnowledgeBaseIndexedSources } from "@/core/lib/knowledge-bases/knowledge-base-catalog";
import { getConfluenceAccessForUser } from "@/core/lib/sources/confluence-access";
import { getDriveAccessForUser } from "@/core/lib/sources/drive-access";
import {
  getConnectorSourceIndexStatus,
  type KbIndexStatus,
} from "@/shared/sources/source-item-status";

const CONNECTOR_SOURCE_TYPES = new Set<SourceConnectorType>([
  "drive",
  "confluence",
  "notion",
  "sharepoint",
  "slack",
]);

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export type KnowledgeBaseCatalogStaleUpdate = {
  kbItemId: string;
  status: KbIndexStatus;
  modifiedAt: string | null;
  driveMimeType?: string | null;
};

async function resolveLiveDriveMetadata(args: {
  tenantId: string;
  fileId: string;
  accessToken: string;
}): Promise<{ modifiedAt: string | null; mimeType: string | null }> {
  try {
    const metadata = await driveGetFileMetadata({
      accessToken: args.accessToken,
      fileId: args.fileId,
      tenantId: args.tenantId,
    });
    return {
      mimeType: metadata.mimeType ?? null,
      modifiedAt: metadata.modifiedTime ?? null,
    };
  } catch {
    return { mimeType: null, modifiedAt: null };
  }
}

async function resolveLiveConfluenceModifiedAt(args: {
  cloudId: string;
  accessToken: string;
  pageId: string;
}): Promise<string | null> {
  try {
    const page = await confluenceGetPage({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      pageId: args.pageId,
    });
    return page.version?.when ?? page.version?.createdAt ?? null;
  } catch {
    return null;
  }
}

async function resolveStaleUpdateForSource(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  source: TeamSourceListRow;
  driveAccessToken: string | null;
  confluenceAccess: { cloudId: string; accessToken: string } | null;
}): Promise<KnowledgeBaseCatalogStaleUpdate | null> {
  if (!CONNECTOR_SOURCE_TYPES.has(args.source.sourceType)) {
    return null;
  }

  const externalRef = args.source.externalRef?.trim();
  if (!externalRef) {
    return null;
  }

  const indexedSourceUpdatedAt = toIso(args.source.sourceUpdatedAt);
  let liveModifiedAt = indexedSourceUpdatedAt;
  let driveMimeType: string | null = null;

  if (args.source.sourceType === "drive" && args.driveAccessToken) {
    const fetchedMetadata = await resolveLiveDriveMetadata({
      accessToken: args.driveAccessToken,
      fileId: externalRef,
      tenantId: args.tenantId,
    });
    if (fetchedMetadata.modifiedAt) {
      liveModifiedAt = fetchedMetadata.modifiedAt;
    }
    driveMimeType = fetchedMetadata.mimeType;
  }

  if (args.source.sourceType === "confluence" && args.confluenceAccess) {
    const fetchedModifiedAt = await resolveLiveConfluenceModifiedAt({
      accessToken: args.confluenceAccess.accessToken,
      cloudId: args.confluenceAccess.cloudId,
      pageId: externalRef,
    });
    if (fetchedModifiedAt) {
      liveModifiedAt = fetchedModifiedAt;
    }
  }

  return {
    kbItemId: args.source.id,
    modifiedAt: liveModifiedAt,
    status: getConnectorSourceIndexStatus({
      indexedSourceUpdatedAt,
      lastIndexedAt: toIso(args.source.lastIndexedAt),
      liveModifiedAt,
      sourceType: args.source.sourceType,
    }),
    ...(args.source.sourceType === "drive" ? { driveMimeType } : {}),
  };
}

export async function checkKnowledgeBaseCatalogStaleStatuses(args: {
  tenantId: string;
  tenantSlug: string;
  knowledgeBaseId: string;
  userId: string;
  userEmail: string;
}): Promise<KnowledgeBaseCatalogStaleUpdate[]> {
  const sources = await loadKnowledgeBaseIndexedSources({
    knowledgeBaseId: args.knowledgeBaseId,
  });
  const connectorSources = sources.filter((source) =>
    CONNECTOR_SOURCE_TYPES.has(source.sourceType)
  );
  if (connectorSources.length === 0) {
    return [];
  }

  const needsDrive = connectorSources.some(
    (source) => source.sourceType === "drive"
  );
  const needsConfluence = connectorSources.some(
    (source) => source.sourceType === "confluence"
  );

  let driveAccessToken: string | null = null;
  if (needsDrive) {
    const access = await getDriveAccessForUser({
      tenantId: args.tenantId,
      tenantSlug: args.tenantSlug,
      userEmail: args.userEmail,
      userId: args.userId,
    });
    if (access.ok) {
      driveAccessToken = access.accessToken;
    }
  }

  let confluenceAccess: { cloudId: string; accessToken: string } | null = null;
  if (needsConfluence) {
    const access = await getConfluenceAccessForUser({
      tenantId: args.tenantId,
      userId: args.userId,
    });
    if (access.ok) {
      confluenceAccess = {
        accessToken: access.accessToken,
        cloudId: access.cloudId,
      };
    }
  }

  const updates = await Promise.all(
    connectorSources.map((source) =>
      resolveStaleUpdateForSource({
        confluenceAccess,
        driveAccessToken,
        source,
        tenantId: args.tenantId,
        tenantSlug: args.tenantSlug,
        userEmail: args.userEmail,
        userId: args.userId,
      })
    )
  );

  return updates.filter(
    (update): update is KnowledgeBaseCatalogStaleUpdate => update !== null
  );
}
