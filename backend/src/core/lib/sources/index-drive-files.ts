import { driveGetFileContent } from "@/core/lib/connectors/providers/google-drive/read";
import { upsertTeamKbDriveItem } from "@/core/lib/db/source-queries";
import { resolveDriveKbSourceExternalAccess } from "@/core/lib/sources/drive-source-external-access";
import { getMaxIndexedContentBytesForTenant } from "@/core/lib/sources/index-content-limits";
import { isResolvableSourceExternalAccess } from "@/core/lib/sources/source-external-access";
import { getDriveAccessForUser } from "./drive-access";

const MAX_FILES_PER_SYNC = 10;

export type DriveIndexResult = {
  fileId: string;
  ok: boolean;
  title?: string;
  error?: string;
};

async function indexOneDriveFile(args: {
  tenantId: string;
  tenantSlug: string;
  userEmail: string;
  fileId: string;
  accessToken: string;
  userId: string;
  maxContentBytes: number;
  maxContentMb: number;
}): Promise<DriveIndexResult> {
  try {
    // Retry once for transient Drive/network failures before failing the file.
    const file = await withRetry(
      () =>
        driveGetFileContent({
          accessToken: args.accessToken,
          fileId: args.fileId,
          maxContentBytes: args.maxContentBytes,
          maxContentMb: args.maxContentMb,
          tenantId: args.tenantId,
          userEmail: args.userEmail,
        }),
      2
    );

    if (!file.content.trim()) {
      return {
        error: "No extractable text in this file.",
        fileId: args.fileId,
        ok: false,
        title: file.title,
      };
    }

    const sourceExternalAccess = await resolveDriveKbSourceExternalAccess({
      accessToken: args.accessToken,
      fileId: args.fileId,
      tenantId: args.tenantId,
      tenantSlug: args.tenantSlug,
      userEmail: args.userEmail,
    }).catch(() => null);

    if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
      return {
        error: "Could not resolve Drive permissions for this file.",
        fileId: args.fileId,
        ok: false,
        title: file.title,
      };
    }

    const input = {
      content: file.content,
      externalRef: file.fileId,
      lastIndexedAt: new Date(),
      link: file.link,
      sourceExternalAccess,
      sourceType: "drive" as const,
      sourceUpdatedAt: file.modifiedTime
        ? new Date(file.modifiedTime)
        : new Date(),
      title: file.title,
    };

    await upsertTeamKbDriveItem({
      createdByUserId: args.userId,
      input,
      tenantId: args.tenantId,
    });

    return { fileId: args.fileId, ok: true, title: file.title };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Index failed.",
      fileId: args.fileId,
      ok: false,
    };
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Retry failed");
}

export async function indexGoogleDriveFilesToKb(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  fileIds: string[];
}): Promise<
  | { ok: false; error: string; results: DriveIndexResult[] }
  | { ok: true; results: DriveIndexResult[] }
> {
  const uniqueIds = [
    ...new Set(args.fileIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    return { error: "Select at least one file.", ok: false, results: [] };
  }
  if (uniqueIds.length > MAX_FILES_PER_SYNC) {
    return {
      error: `Index up to ${MAX_FILES_PER_SYNC} files at a time.`,
      ok: false,
      results: [],
    };
  }

  const access = await getDriveAccessForUser({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  if (!access.ok) {
    return { error: access.error, ok: false, results: [] };
  }

  const { maxBytes, maxMb } = await getMaxIndexedContentBytesForTenant(
    args.tenantId
  );

  const results = await Promise.all(
    uniqueIds.map((fileId) =>
      indexOneDriveFile({
        accessToken: access.accessToken,
        fileId,
        maxContentBytes: maxBytes,
        maxContentMb: maxMb,
        tenantId: args.tenantId,
        tenantSlug: args.tenantSlug,
        userEmail: args.userEmail,
        userId: args.userId,
      })
    )
  );

  const anyOk = results.some((result) => result.ok);
  if (!anyOk) {
    return {
      error: results.at(0)?.error ?? "Could not index selected files.",
      ok: false,
      results,
    };
  }

  return { ok: true, results };
}
