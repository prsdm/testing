import { confluenceGetPageMetadata } from "@/core/lib/connectors/providers/confluence/api";
import { confluenceGetPageContent } from "@/core/lib/connectors/providers/confluence/read";
import { upsertTeamKbConfluenceItem } from "@/core/lib/db/source-queries";
import { getConfluenceAccessForUser } from "@/core/lib/sources/confluence-access";
import {
  syncConfluenceSpaceMemberships,
  syncTenantConfluenceMemberships,
} from "@/core/lib/sources/confluence-membership-sync";
import { resolveConfluencePageSourceExternalAccess } from "@/core/lib/sources/confluence-source-external-access";
import { getMaxIndexedContentBytesForTenant } from "@/core/lib/sources/index-content-limits";
import { isResolvableSourceExternalAccess } from "@/core/lib/sources/source-external-access";

const MAX_PAGES_PER_SYNC = 10;

export type ConfluenceIndexResult = {
  pageId: string;
  ok: boolean;
  title?: string;
  error?: string;
};

async function indexOneConfluencePage(args: {
  tenantId: string;
  pageId: string;
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  userId: string;
  userEmail: string;
  maxContentBytes: number;
  maxContentMb: number;
}): Promise<ConfluenceIndexResult> {
  try {
    const page = await confluenceGetPageContent({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      maxContentBytes: args.maxContentBytes,
      maxContentMb: args.maxContentMb,
      pageId: args.pageId,
      siteUrl: args.siteUrl,
    });
    if (!page.content.trim()) {
      return {
        error: "No extractable text in this page.",
        ok: false,
        pageId: args.pageId,
        title: page.title,
      };
    }

    const pageMetadata = await confluenceGetPageMetadata({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      pageId: args.pageId,
    }).catch(() => ({ spaceId: undefined }));

    const sourceExternalAccess =
      await resolveConfluencePageSourceExternalAccess({
        accessToken: args.accessToken,
        cloudId: args.cloudId,
        indexerEmail: args.userEmail,
        pageId: args.pageId,
        spaceId: pageMetadata.spaceId,
      }).catch(() => null);

    if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
      return {
        error: "Could not resolve Confluence permissions for this page.",
        ok: false,
        pageId: args.pageId,
        title: page.title,
      };
    }

    await upsertTeamKbConfluenceItem({
      createdByUserId: args.userId,
      input: {
        content: page.content,
        externalRef: page.pageId,
        lastIndexedAt: new Date(),
        link: page.link,
        sourceExternalAccess,
        sourceType: "confluence",
        sourceUpdatedAt: page.modifiedTime
          ? new Date(page.modifiedTime)
          : new Date(),
        title: page.title,
      },
      tenantId: args.tenantId,
    });

    if (pageMetadata.spaceId) {
      await syncConfluenceSpaceMemberships({
        accessToken: args.accessToken,
        cloudId: args.cloudId,
        spaceId: pageMetadata.spaceId,
        tenantId: args.tenantId,
      }).catch(() => undefined);
    }

    return { ok: true, pageId: args.pageId, title: page.title };
  } catch (error) {
    const asObject =
      typeof error === "object" && error !== null
        ? (error as { cause?: unknown; message?: unknown })
        : null;
    const causeText =
      typeof asObject?.cause === "string" ? asObject.cause.trim() : "";
    const messageText =
      typeof asObject?.message === "string" ? asObject.message.trim() : "";
    const detail = causeText || messageText || "Index failed.";
    return {
      error: detail,
      ok: false,
      pageId: args.pageId,
    };
  }
}

export async function indexConfluencePagesToKb(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  pageIds: string[];
}): Promise<
  | { ok: false; error: string; results: ConfluenceIndexResult[] }
  | { ok: true; results: ConfluenceIndexResult[] }
> {
  const uniqueIds = [
    ...new Set(args.pageIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    return { error: "Select at least one page.", ok: false, results: [] };
  }
  if (uniqueIds.length > MAX_PAGES_PER_SYNC) {
    return {
      error: `Index up to ${MAX_PAGES_PER_SYNC} pages at a time.`,
      ok: false,
      results: [],
    };
  }

  const access = await getConfluenceAccessForUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!access.ok) {
    return { error: access.error, ok: false, results: [] };
  }

  const { maxBytes, maxMb } = await getMaxIndexedContentBytesForTenant(
    args.tenantId
  );

  const results = await Promise.all(
    uniqueIds.map((pageId) =>
      indexOneConfluencePage({
        accessToken: access.accessToken,
        cloudId: access.cloudId,
        maxContentBytes: maxBytes,
        maxContentMb: maxMb,
        pageId,
        siteUrl: access.siteUrl,
        tenantId: args.tenantId,
        userEmail: args.userEmail,
        userId: args.userId,
      })
    )
  );
  const anyOk = results.some((result) => result.ok);
  if (!anyOk) {
    return {
      error: results.at(0)?.error ?? "Could not index selected pages.",
      ok: false,
      results,
    };
  }

  await syncTenantConfluenceMemberships({
    tenantId: args.tenantId,
    userId: args.userId,
  }).catch(() => undefined);

  return { ok: true, results };
}
