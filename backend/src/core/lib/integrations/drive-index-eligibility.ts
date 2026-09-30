import { getTenantPeopleProviderConfigBySlug } from "@/core/lib/db/queries";
import { getTenantSearchRuntimeSettings } from "@/core/lib/db/search-index-queries";
import { envSearchRuntimeSettings } from "@/core/lib/search/runtime-settings";

function readDirectory(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const directory = (metadata as { directory?: unknown }).directory;
  if (!directory || typeof directory !== "object" || Array.isArray(directory)) {
    return {};
  }
  return directory as Record<string, unknown>;
}

export function isDriveCredentialsReady(
  directory: Record<string, unknown>,
  primaryDomain: string
) {
  const delegatedAdminEmail =
    typeof directory.delegatedAdminEmail === "string"
      ? directory.delegatedAdminEmail.trim()
      : "";
  const serviceAccountClientEmail =
    typeof directory.serviceAccountClientEmail === "string"
      ? directory.serviceAccountClientEmail.trim()
      : "";
  const hasPrivateKey =
    typeof directory.serviceAccountPrivateKey === "string" &&
    directory.serviceAccountPrivateKey.length > 0;
  const domain =
    typeof directory.domain === "string" && directory.domain.trim()
      ? directory.domain.trim()
      : primaryDomain;

  return {
    delegatedAdminEmail,
    domain,
    driveReady: Boolean(
      delegatedAdminEmail && serviceAccountClientEmail && hasPrivateKey
    ),
    hasPrivateKey,
    serviceAccountClientEmail,
  };
}

export async function getDriveIndexEligibility(input: {
  tenantId: string;
  tenantSlug: string;
  primaryDomain: string;
}) {
  const [runtime, providerConfig] = await Promise.all([
    getTenantSearchRuntimeSettings(input.tenantId),
    getTenantPeopleProviderConfigBySlug(input.tenantSlug),
  ]);

  const directory = readDirectory(providerConfig?.metadata);
  const credentials = isDriveCredentialsReady(directory, input.primaryDomain);

  const envAllowsIndexing = envSearchRuntimeSettings().indexingEnabled;
  const indexingEnabled = envAllowsIndexing && runtime.indexingEnabled;

  let canIndex = indexingEnabled && credentials.driveReady;
  let reason: string | null = null;

  if (!envAllowsIndexing) {
    canIndex = false;
    reason =
      "Indexing is off globally. Set INDEXING_ENABLED=true in .env and restart the dev server.";
  } else if (!runtime.indexingEnabled) {
    canIndex = false;
    reason = "Indexing is disabled for this tenant.";
  } else if (!credentials.driveReady) {
    canIndex = false;
    reason =
      "Upload the service account JSON key and save the delegated admin email.";
  }

  return {
    canIndex,
    credentials,
    driveReady: credentials.driveReady,
    envAllowsIndexing,
    indexingEnabled,
    reason,
    runtimeSettings: runtime,
  };
}
