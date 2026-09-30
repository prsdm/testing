import { driveGetFileForAccess } from "@/core/lib/connectors/providers/google-drive/read";
import { getTenantPeopleProviderConfigBySlug } from "@/core/lib/db/queries";
import { parseDirectoryCredentials } from "@/core/lib/search/google-drive/client";
import { getExternalAccessAclForDriveFileWithRetry } from "@/core/lib/search/google-drive/document-access";
import type { DriveFileForAccess } from "@/core/lib/search/google-drive/external-access";
import {
  aclTokensToSourceExternalAccess,
  type SourceExternalAccess,
} from "@/core/lib/sources/source-external-access";

export async function fetchDriveFileSourceExternalAccess(args: {
  tenantSlug: string;
  userEmail: string;
  accessToken: string;
  file: DriveFileForAccess;
}): Promise<SourceExternalAccess> {
  const providerConfig = await getTenantPeopleProviderConfigBySlug(
    args.tenantSlug
  );
  const credentials = parseDirectoryCredentials(providerConfig?.metadata);
  const companyDomain =
    credentials?.domain?.trim().toLowerCase() ??
    args.userEmail.split("@").at(1)?.trim().toLowerCase() ??
    "";

  const tokens = await getExternalAccessAclForDriveFileWithRetry({
    accessToken: args.accessToken,
    companyDomain,
    fallbackUserEmail: args.userEmail,
    file: args.file,
  });

  return aclTokensToSourceExternalAccess({
    sourceType: "drive",
    tokens,
  });
}

export async function resolveDriveKbSourceExternalAccess(args: {
  tenantId: string;
  tenantSlug: string;
  userEmail: string;
  accessToken: string;
  fileId: string;
}): Promise<SourceExternalAccess> {
  const file = await driveGetFileForAccess({
    accessToken: args.accessToken,
    fileId: args.fileId,
    tenantId: args.tenantId,
  });
  return fetchDriveFileSourceExternalAccess({
    accessToken: args.accessToken,
    file,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
  });
}
