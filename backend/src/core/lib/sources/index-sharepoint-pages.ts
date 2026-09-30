import {
  type SharePointPageSummary,
  sharePointGetPageContent,
} from "@/core/lib/connectors/providers/sharepoint/read";
import { upsertTeamKbSharePointItem } from "@/core/lib/db/source-queries";
import { getMaxIndexedContentBytesForTenant } from "@/core/lib/sources/index-content-limits";
import { getSharePointAccessForUser } from "@/core/lib/sources/sharepoint-access";
import { syncTenantSharePointMemberships } from "@/core/lib/sources/sharepoint-membership-sync";
import { resolveSharePointPageSourceExternalAccess } from "@/core/lib/sources/sharepoint-source-external-access";
import { isResolvableSourceExternalAccess } from "@/core/lib/sources/source-external-access";

const MAX_PAGES_PER_SYNC = 10;

export type SharePointIndexResult = {
  pageRef: string;
  ok: boolean;
  title?: string;
  error?: string;
};

function parsePageRef(pageRef: string) {
  const [siteId, pageId] = pageRef.split("::");
  if (!siteId || !pageId) {
    return null;
  }
  return { pageId, siteId };
}

export function toSharePointPageRef(
  page: Pick<SharePointPageSummary, "siteId" | "pageId">
) {
  return `${page.siteId}::${page.pageId}`;
}

async function indexOneSharePointPage(args: {
  tenantId: string;
  pageRef: string;
  accessToken: string;
  userId: string;
  userEmail: string;
  maxContentBytes: number;
  maxContentMb: number;
}): Promise<SharePointIndexResult> {
  const parsedRef = parsePageRef(args.pageRef);
  if (!parsedRef) {
    return {
      error: "Invalid page reference format.",
      ok: false,
      pageRef: args.pageRef,
    };
  }

  try {
    const page = await sharePointGetPageContent({
      accessToken: args.accessToken,
      maxContentBytes: args.maxContentBytes,
      maxContentMb: args.maxContentMb,
      pageId: parsedRef.pageId,
      siteId: parsedRef.siteId,
    });
    if (!page.content.trim()) {
      return {
        error: "No extractable text in this page.",
        ok: false,
        pageRef: args.pageRef,
        title: page.title,
      };
    }

    const sourceExternalAccess =
      await resolveSharePointPageSourceExternalAccess({
        accessToken: args.accessToken,
        indexerEmail: args.userEmail,
        pageId: parsedRef.pageId,
        siteId: parsedRef.siteId,
      }).catch(() => null);

    if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
      return {
        error: "Could not resolve SharePoint permissions for this page.",
        ok: false,
        pageRef: args.pageRef,
        title: page.title,
      };
    }

    await upsertTeamKbSharePointItem({
      createdByUserId: args.userId,
      input: {
        content: page.content,
        externalRef: args.pageRef,
        lastIndexedAt: new Date(),
        link: page.link,
        sourceExternalAccess,
        sourceType: "sharepoint",
        sourceUpdatedAt: page.modifiedTime
          ? new Date(page.modifiedTime)
          : new Date(),
        title: page.title,
      },
      tenantId: args.tenantId,
    });
    return { ok: true, pageRef: args.pageRef, title: page.title };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Index failed.";
    return { error: message, ok: false, pageRef: args.pageRef };
  }
}

export async function indexSharePointPagesToKb(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  pageRefs: string[];
}): Promise<
  | { ok: false; error: string; results: SharePointIndexResult[] }
  | { ok: true; results: SharePointIndexResult[] }
> {
  const uniqueRefs = [
    ...new Set(args.pageRefs.map((id) => id.trim()).filter(Boolean)),
  ];
  if (uniqueRefs.length === 0) {
    return { error: "Select at least one page.", ok: false, results: [] };
  }
  if (uniqueRefs.length > MAX_PAGES_PER_SYNC) {
    return {
      error: `Index up to ${MAX_PAGES_PER_SYNC} pages at a time.`,
      ok: false,
      results: [],
    };
  }

  const access = await getSharePointAccessForUser({
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
    uniqueRefs.map((pageRef) =>
      indexOneSharePointPage({
        accessToken: access.accessToken,
        maxContentBytes: maxBytes,
        maxContentMb: maxMb,
        pageRef,
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

  await syncTenantSharePointMemberships({
    tenantId: args.tenantId,
    userId: args.userId,
  }).catch(() => undefined);

  return { ok: true, results };
}
