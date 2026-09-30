import {
  confluenceGetPage,
  confluencePageResult,
  confluencePutPage,
} from "@/core/lib/connectors/providers/confluence/api";
import { assertConfluenceActionAllowed } from "@/core/lib/connectors/providers/confluence/auth";
import { resolveConfluencePageId } from "@/core/lib/connectors/providers/confluence/resolve-page-by-title";
import { mergePageStorageHtml } from "@/core/lib/connectors/providers/confluence/storage-html";

export async function confluenceUpdatePage(input: {
  tenantId: string;
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  spaceKey?: string;
  content: string;
  contentMode?: "append" | "replace";
}): Promise<{ pageId: string; title: string; link: string }> {
  await assertConfluenceActionAllowed({
    action: "write",
    tenantId: input.tenantId,
  });
  const page = await resolveConfluencePageId({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    pageId: input.pageId,
    pageTitle: input.pageTitle,
    siteUrl: input.siteUrl,
    spaceKey: input.spaceKey,
  });
  const content = input.content.trim();
  if (!content) {
    throw new Error("content is required.");
  }

  const current = await confluenceGetPage({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    pageId: page.pageId,
  });
  const nextVersion = (current.version?.number ?? 0) + 1;
  const resolvedTitle = current.title ?? page.title;
  const contentMode = input.contentMode ?? "append";
  const storageHtml = mergePageStorageHtml({
    content,
    contentMode,
    existingHtml: current.body?.storage?.value ?? "",
  });

  const updated = await confluencePutPage({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    pageId: page.pageId,
    storageHtml,
    title: resolvedTitle,
    versionNumber: nextVersion,
  });

  return confluencePageResult({
    fallbackPageId: page.pageId,
    fallbackTitle: resolvedTitle,
    page: updated,
    siteUrl: input.siteUrl,
  });
}
