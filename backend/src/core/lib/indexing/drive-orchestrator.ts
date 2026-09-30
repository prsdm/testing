import {
  getTenantBySlug,
  getTenantPeopleProviderConfigBySlug,
} from "@/core/lib/db/queries";
import {
  completeIndexRun,
  createIndexRun,
  getTenantSearchRuntimeSettings,
} from "@/core/lib/db/search-index-queries";
import { isIndexingEnabled } from "@/core/lib/search/config";
import { parseDirectoryCredentials } from "@/core/lib/search/google-drive/client";
import { getDriveAccessTokenForUser } from "@/core/lib/search/google-drive/drive-auth";
import { listDriveFilesForWorkspace } from "@/core/lib/search/google-drive/fetch";
import { syncTenantDriveMemberships } from "@/core/lib/search/google-drive/membership-sync";
import { indexDriveFilesForTenant } from "@/core/lib/search/index-drive-documents";

export async function runTenantDriveIndexBySlug(tenantSlug: string) {
  const tenant = await getTenantBySlug(tenantSlug);
  if (tenant?.status !== "active") {
    throw new Error(`Active tenant not found: ${tenantSlug}`);
  }

  const settings = await getTenantSearchRuntimeSettings(tenant.id);
  if (!isIndexingEnabled(settings)) {
    throw new Error("Indexing is disabled for this tenant.");
  }

  const providerConfig = await getTenantPeopleProviderConfigBySlug(tenantSlug);
  const credentials = parseDirectoryCredentials(providerConfig?.metadata);

  const companyDomainRaw =
    credentials.domain?.trim() || tenant.primaryDomain?.trim() || "";
  const companyDomain = companyDomainRaw ? companyDomainRaw.toLowerCase() : "";
  if (!companyDomain) {
    throw new Error(
      "Company domain is required for Drive ACL. Set Workspace domain in People → Settings, or ensure the tenant has a primary domain."
    );
  }

  const run = await createIndexRun(tenant.id);
  try {
    const membershipSync = await syncTenantDriveMemberships({
      credentials,
      googleDomain: companyDomain,
      tenantId: tenant.id,
    });

    const collected = await listDriveFilesForWorkspace({
      credentials,
      googleDomain: companyDomain,
    });

    const maxContentMb = settings.maxIndexedContentSizeMb;

    const fallbackUserEmail = credentials.delegatedAdminEmail?.trim() || "";

    const tokenCache = new Map<string, string>();
    const getTokenForFile = async (file: { retrieverUserEmail?: string }) => {
      const subject = file.retrieverUserEmail || fallbackUserEmail;
      if (!subject) {
        throw new Error(
          "Delegated admin email is required for Drive indexing."
        );
      }
      const cached = tokenCache.get(subject);
      if (cached) {
        return cached;
      }
      const token = await getDriveAccessTokenForUser(credentials, subject);
      tokenCache.set(subject, token);
      return token;
    };

    const result = await indexDriveFilesForTenant({
      companyDomain,
      fallbackUserEmail,
      files: collected,
      getAccessTokenForFile: getTokenForFile,
      settings,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    });

    const status =
      result.indexedDocuments > 0 || result.unchangedFiles > 0
        ? ("success" as const)
        : ("partial" as const);

    await completeIndexRun({
      chunksIndexed: result.indexedChunks,
      documentsIndexed: result.indexedDocuments,
      metadata: {
        filesListed: result.listedFiles,
        filesRemoved: result.removedFiles,
        filesSkipped: result.skippedFiles,
        filesUnchanged: result.unchangedFiles,
        maxIndexedContentSizeMb: maxContentMb,
        membershipSync,
        prunedStaleDocuments: result.prunedStaleDocuments,
        skippedSamples: result.skippedSamples,
      },
      runId: run.id,
      status,
    });

    return {
      chunksIndexed: result.indexedChunks,
      documentsIndexed: result.indexedDocuments,
      listedFiles: result.listedFiles,
      membershipSync,
      prunedStaleDocuments: result.prunedStaleDocuments,
      removedFiles: result.removedFiles,
      runId: run.id,
      skippedFiles: result.skippedFiles,
      skippedSamples: result.skippedSamples,
      unchangedFiles: result.unchangedFiles,
    };
  } catch (error) {
    await completeIndexRun({
      chunksIndexed: 0,
      documentsIndexed: 0,
      errorMessage:
        error instanceof Error ? error.message : "Drive index failed",
      errorsCount: 1,
      runId: run.id,
      status: "failed",
    });
    throw error;
  }
}
