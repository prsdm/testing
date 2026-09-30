import { notionGetPageContent } from "@/core/lib/connectors/providers/notion/read";
import {
  getTeamKbNotionItemByExternalRef,
  upsertTeamKbNotionItem,
} from "@/core/lib/db/source-queries";
import { getMaxIndexedContentBytesForTenant } from "@/core/lib/sources/index-content-limits";
import { getNotionAccessForUser } from "@/core/lib/sources/notion-access";
import { resolveNotionPageSourceExternalAccess } from "@/core/lib/sources/notion-source-external-access";
import { isResolvableSourceExternalAccess } from "@/core/lib/sources/source-external-access";

const MAX_PAGES_PER_SYNC = 10;

export type NotionIndexResult = {
  pageId: string;
  ok: boolean;
  title?: string;
  error?: string;
};

import type { NotionShareMode } from "@/shared/sources/notion-share-mode";

type NotionIndexContext = {
  tenantId: string;
  userId: string;
  userEmail: string;
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  actorIsAdmin?: boolean;
};

async function indexOneNotionPage(args: {
  tenantId: string;
  pageId: string;
  accessToken: string;
  userId: string;
  userEmail: string;
  shareMode?: NotionShareMode;
  shareWithEmails?: string[];
  actorIsAdmin?: boolean;
  maxContentBytes: number;
  maxContentMb: number;
}): Promise<NotionIndexResult> {
  try {
    const page = await notionGetPageContent({
      accessToken: args.accessToken,
      maxContentBytes: args.maxContentBytes,
      maxContentMb: args.maxContentMb,
      pageId: args.pageId,
    });
    if (!page.content.trim()) {
      return {
        error: "No extractable text in this page.",
        ok: false,
        pageId: args.pageId,
        title: page.title,
      };
    }

    const existing = await getTeamKbNotionItemByExternalRef({
      externalRef: page.pageId,
      tenantId: args.tenantId,
    });

    const sourceExternalAccess = resolveNotionPageSourceExternalAccess({
      actorIsAdmin: args.actorIsAdmin,
      actorUserId: args.userId,
      existingAccess: existing?.sourceExternalAccess,
      indexerEmail: args.userEmail,
      ownerUserId: existing?.createdByUserId,
      shareMode: args.shareMode,
      shareWithEmails: args.shareWithEmails,
    });

    if (!isResolvableSourceExternalAccess(sourceExternalAccess)) {
      return {
        error: "Could not resolve Notion permissions for this page.",
        ok: false,
        pageId: args.pageId,
        title: page.title,
      };
    }

    await upsertTeamKbNotionItem({
      createdByUserId: args.userId,
      input: {
        content: page.content,
        externalRef: page.pageId,
        lastIndexedAt: new Date(),
        link: page.link,
        sourceExternalAccess,
        sourceType: "notion",
        sourceUpdatedAt: page.modifiedTime
          ? new Date(page.modifiedTime)
          : new Date(),
        title: page.title,
      },
      tenantId: args.tenantId,
    });
    return { ok: true, pageId: args.pageId, title: page.title };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Index failed.";
    return {
      error: message,
      ok: false,
      pageId: args.pageId,
    };
  }
}

export async function indexNotionPagesToKb(
  args: NotionIndexContext & { pageIds: string[] }
): Promise<
  | { ok: false; error: string; results: NotionIndexResult[] }
  | { ok: true; results: NotionIndexResult[] }
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

  const access = await getNotionAccessForUser({
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
      indexOneNotionPage({
        accessToken: access.accessToken,
        actorIsAdmin: args.actorIsAdmin,
        maxContentBytes: maxBytes,
        maxContentMb: maxMb,
        pageId,
        shareMode: args.shareMode,
        shareWithEmails: args.shareWithEmails,
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
  return { ok: true, results };
}
