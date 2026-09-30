import {
  getTenantBySlug,
  getTenantPeopleProviderConfigBySlug,
} from "@/core/lib/db/queries";
import { parseDirectoryCredentials } from "@/core/lib/search/google-drive/client";
import { syncTenantDriveMemberships } from "@/core/lib/search/google-drive/membership-sync";

export async function runTenantDriveMembershipSyncBySlug(tenantSlug: string) {
  const tenant = await getTenantBySlug(tenantSlug);
  if (tenant?.status !== "active") {
    throw new Error(`Active tenant not found: ${tenantSlug}`);
  }

  const providerConfig = await getTenantPeopleProviderConfigBySlug(tenantSlug);
  const credentials = parseDirectoryCredentials(providerConfig?.metadata);

  const companyDomainRaw =
    credentials.domain?.trim() || tenant.primaryDomain?.trim() || "";
  const googleDomain = companyDomainRaw ? companyDomainRaw.toLowerCase() : "";
  if (!googleDomain) {
    throw new Error(
      "Company domain is required for Drive membership sync. Set Workspace domain in People → Settings."
    );
  }

  return syncTenantDriveMemberships({
    credentials,
    googleDomain,
    tenantId: tenant.id,
  });
}
