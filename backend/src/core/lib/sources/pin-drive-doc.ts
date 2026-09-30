import { driveGetFileContent } from "@/core/lib/connectors/providers/google-drive/read";
import { upsertTeamKbDriveItem } from "@/core/lib/db/source-queries";
import { resolveDriveKbSourceExternalAccess } from "@/core/lib/sources/drive-source-external-access";
import { getMaxIndexedContentBytesForTenant } from "@/core/lib/sources/index-content-limits";
import { isResolvableSourceExternalAccess } from "@/core/lib/sources/source-external-access";
import { getDriveAccessForUser } from "./drive-access";

export async function pinGoogleDriveFileToKb(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  fileId: string;
}) {
  const fileId = args.fileId.trim();
  if (!fileId) {
    return { error: "Drive file ID is required.", ok: false as const };
  }

  const access = await getDriveAccessForUser({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  if (!access.ok) {
    return { error: access.error, ok: false as const };
  }

  const { maxBytes, maxMb } = await getMaxIndexedContentBytesForTenant(
    args.tenantId
  );

  const file = await driveGetFileContent({
    accessToken: access.accessToken,
    fileId,
    maxContentBytes: maxBytes,
    maxContentMb: maxMb,
    tenantId: args.tenantId,
    userEmail: args.userEmail,
  });

  if (!file.content.trim()) {
    return {
      error: "Could not read text from that Drive file.",
      ok: false as const,
    };
  }

  const sourceExternalAccess = await resolveDriveKbSourceExternalAccess({
    accessToken: access.accessToken,
    fileId,
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
  }).catch(() => null);

  if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
    return {
      error: "Could not resolve Drive permissions for this file.",
      ok: false as const,
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

  const item = await upsertTeamKbDriveItem({
    createdByUserId: args.userId,
    input,
    tenantId: args.tenantId,
  });
  return { item, ok: true as const };
}
