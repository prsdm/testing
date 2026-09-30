import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { decryptDirectoryCredentials } from "@/core/lib/security/directory-secrets";
import { getDriveAccessTokenForUser } from "./drive-auth";

export async function getDriveAccessToken(
  credentials: ProviderDirectoryCredentials
) {
  if (!credentials.delegatedAdminEmail?.trim()) {
    throw new Error(
      "Google Drive indexing requires delegated admin email in People settings."
    );
  }
  return await getDriveAccessTokenForUser(
    credentials,
    credentials.delegatedAdminEmail.trim()
  );
}

export function parseDirectoryCredentials(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  const directory = (metadata as { directory?: ProviderDirectoryCredentials })
    .directory;
  if (!directory || typeof directory !== "object") {
    return {};
  }
  return decryptDirectoryCredentials(directory);
}
