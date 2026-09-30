import { driveGetFileMetadata } from "@/core/lib/connectors/providers/google-drive/read";
import type { SourceConnectorType } from "@/core/lib/db/source-queries";
import type { KnowledgeBaseSourceWithItem } from "@/core/lib/knowledge-bases/knowledge-base-queries";
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

export type KnowledgeBaseSourceWithIndexStatus = KnowledgeBaseSourceWithItem & {
  indexStatus: KbIndexStatus;
  sourceModifiedAt: string | null;
};

async function resolveLiveDriveModifiedAt(args: {
  tenantId: string;
  fileId: string;
  accessToken: string;
}): Promise<string | null> {
  try {
    const metadata = await driveGetFileMetadata({
      accessToken: args.accessToken,
      fileId: args.fileId,
      tenantId: args.tenantId,
    });
    return metadata.modifiedTime ?? null;
  } catch {
    return null;
  }
}

export async function enrichKnowledgeBaseSourcesWithIndexStatus(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  sources: KnowledgeBaseSourceWithItem[];
}): Promise<KnowledgeBaseSourceWithIndexStatus[]> {
  const driveFileIds = args.sources
    .filter(
      (entry) =>
        entry.source.sourceType === "drive" && entry.source.externalRef?.trim()
    )
    .map((entry) => entry.source.externalRef?.trim() ?? "");

  let driveAccessToken: string | null = null;
  if (driveFileIds.length > 0) {
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

  return Promise.all(
    args.sources.map(async (entry) => {
      const { source } = entry;
      const indexedSourceUpdatedAt = toIso(source.sourceUpdatedAt);
      let liveModifiedAt = indexedSourceUpdatedAt;

      if (
        source.sourceType === "drive" &&
        source.externalRef?.trim() &&
        driveAccessToken
      ) {
        const fetchedModifiedAt = await resolveLiveDriveModifiedAt({
          accessToken: driveAccessToken,
          fileId: source.externalRef.trim(),
          tenantId: args.tenantId,
        });
        if (fetchedModifiedAt) {
          liveModifiedAt = fetchedModifiedAt;
        }
      }

      const indexStatus = getConnectorSourceIndexStatus({
        indexedSourceUpdatedAt,
        lastIndexedAt: toIso(source.lastIndexedAt),
        liveModifiedAt,
        sourceType: source.sourceType,
      });

      return {
        ...entry,
        indexStatus,
        sourceModifiedAt: liveModifiedAt,
      };
    })
  );
}

export function knowledgeBaseSourceShowsIndexStatus(
  sourceType: SourceConnectorType
) {
  return CONNECTOR_SOURCE_TYPES.has(sourceType);
}
