import {
  driveGetFileAccessStatus,
  driveGetFileContent,
  driveGetFileMetadata,
} from "@/core/lib/connectors/providers/google-drive/read";
import {
  deleteTeamKbItem,
  listDriveTeamKbItemsForAutoIndex,
  upsertTeamKbDriveItem,
} from "@/core/lib/db/source-queries";
import type { TeamSource } from "@/core/lib/db/tables";
import { getDriveAccessForUser } from "@/core/lib/sources/drive-access";
import { resolveDriveKbSourceExternalAccess } from "@/core/lib/sources/drive-source-external-access";
import { getMaxIndexedContentBytesForTenant } from "@/core/lib/sources/index-content-limits";
import { isResolvableSourceExternalAccess } from "@/core/lib/sources/source-external-access";

const AUTO_SYNC_MAX_ITEMS = 20;

function toMillis(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }
  const asDate = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(asDate.getTime()) ? 0 : asDate.getTime();
}

type AutoIndexResult = {
  checked: number;
  updated: number;
  deleted: number;
  skipped: number;
};

function errorContainsSchemaMismatch(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const causeText =
    typeof error.cause === "string"
      ? error.cause
      : error.cause instanceof Error
        ? `${error.cause.message}`
        : "";
  const searchable = `${error.message} ${causeText}`.toLowerCase();
  return (
    searchable.includes("sourceupdatedat") ||
    searchable.includes("lastindexedat") ||
    searchable.includes("does not exist")
  );
}

export async function autoIndexModifiedDriveKnowledgeForUser(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  limit?: number;
}): Promise<AutoIndexResult> {
  const limit = Math.min(
    args.limit ?? AUTO_SYNC_MAX_ITEMS,
    AUTO_SYNC_MAX_ITEMS
  );
  let driveItems: TeamSource[];
  try {
    driveItems = await listDriveTeamKbItemsForAutoIndex({
      limit,
      tenantId: args.tenantId,
      userId: args.userId,
    });
  } catch (error) {
    if (errorContainsSchemaMismatch(error)) {
      // Schema is behind code (migration not applied yet): skip autoindex safely.
      return { checked: 0, deleted: 0, skipped: 0, updated: 0 };
    }
    throw error;
  }
  const items = driveItems.filter((item) => Boolean(item.externalRef));
  if (items.length === 0) {
    return { checked: 0, deleted: 0, skipped: 0, updated: 0 };
  }

  const access = await getDriveAccessForUser({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  if (!access.ok) {
    return {
      checked: items.length,
      deleted: 0,
      skipped: items.length,
      updated: 0,
    };
  }

  const { maxBytes, maxMb } = await getMaxIndexedContentBytesForTenant(
    args.tenantId
  );

  const statuses = await Promise.all(
    items.map(async (item) => {
      const fileId = item.externalRef;
      if (!fileId) {
        return { item, status: "unknown_error" as const };
      }
      const status = await driveGetFileAccessStatus({
        accessToken: access.accessToken,
        fileId,
        tenantId: args.tenantId,
      });
      return { item, status };
    })
  );

  const toDelete = statuses
    .filter((entry) => entry.status === "not_found")
    .map((entry) => entry.item);
  const toCheckForUpdates = statuses
    .filter((entry) => entry.status === "accessible")
    .map((entry) => entry.item);
  const skipped = statuses.length - toDelete.length - toCheckForUpdates.length;

  const maybeChanged = await Promise.all(
    toCheckForUpdates.map(async (item) => {
      const fileId = item.externalRef;
      if (!fileId) {
        return null;
      }
      const metadata = await driveGetFileMetadata({
        accessToken: access.accessToken,
        fileId,
        tenantId: args.tenantId,
      }).catch(() => null);
      if (metadata?.trashed) {
        return { delete: true as const, item };
      }
      if (!metadata?.modifiedTime) {
        return null;
      }
      const sourceMillis = toMillis(metadata.modifiedTime);
      const storedMillis = toMillis(item.sourceUpdatedAt);
      if (sourceMillis <= storedMillis) {
        return null;
      }
      return { delete: false as const, item, metadata };
    })
  );
  const changed = maybeChanged.filter(
    (
      value
    ): value is {
      item: TeamSource;
      metadata: { modifiedTime?: string };
      delete: false;
    } => value !== null && value.delete === false
  );
  const trashedToDelete = maybeChanged
    .filter(
      (value): value is { item: TeamSource; delete: true } =>
        value !== null && value.delete === true
    )
    .map((value) => value.item);

  const updatedResults = await Promise.all(
    changed.map(async (entry) => {
      const fileId = entry.item.externalRef;
      if (!fileId) {
        return false;
      }
      const content = await driveGetFileContent({
        accessToken: access.accessToken,
        fileId,
        maxContentBytes: maxBytes,
        maxContentMb: maxMb,
        tenantId: args.tenantId,
        userEmail: args.userEmail,
      }).catch(() => null);
      if (!content?.content.trim()) {
        return false;
      }
      const sourceExternalAccess = await resolveDriveKbSourceExternalAccess({
        accessToken: access.accessToken,
        fileId,
        tenantId: args.tenantId,
        tenantSlug: args.tenantSlug,
        userEmail: args.userEmail,
      }).catch(() => null);
      if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
        return false;
      }
      await upsertTeamKbDriveItem({
        createdByUserId: args.userId,
        input: {
          content: content.content,
          externalRef: content.fileId,
          lastIndexedAt: new Date(),
          link: content.link,
          sourceExternalAccess,
          sourceType: "drive",
          sourceUpdatedAt: content.modifiedTime
            ? new Date(content.modifiedTime)
            : new Date(),
          title: content.title,
        },
        tenantId: args.tenantId,
      });
      return true;
    })
  );

  const deletedResults = await Promise.all(
    [...toDelete, ...trashedToDelete].map(async (item) =>
      deleteTeamKbItem({
        itemId: item.id,
        tenantId: args.tenantId,
      })
    )
  );

  return {
    checked: items.length,
    deleted: deletedResults.filter(Boolean).length,
    skipped,
    updated: updatedResults.filter(Boolean).length,
  };
}
