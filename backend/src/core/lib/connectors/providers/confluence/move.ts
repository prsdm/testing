import {
  confluenceGetPage,
  confluencePageResult,
  confluencePutPage,
} from "@/core/lib/connectors/providers/confluence/api";
import { assertConfluenceActionAllowed } from "@/core/lib/connectors/providers/confluence/auth";
import { resolveConfluencePageId } from "@/core/lib/connectors/providers/confluence/resolve-page-by-title";

export async function confluenceMovePage(input: {
  tenantId: string;
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  spaceKey?: string;
  parentPageId?: string;
  parentPageTitle?: string;
}): Promise<{
  pageId: string;
  title: string;
  link: string;
  parentPageId: string;
}> {
  await assertConfluenceActionAllowed({
    action: "write",
    tenantId: input.tenantId,
  });

  const [page, parent] = await Promise.all([
    resolveConfluencePageId({
      accessToken: input.accessToken,
      cloudId: input.cloudId,
      pageId: input.pageId,
      pageTitle: input.pageTitle,
      siteUrl: input.siteUrl,
      spaceKey: input.spaceKey,
    }),
    resolveConfluencePageId({
      accessToken: input.accessToken,
      cloudId: input.cloudId,
      idLabel: "parentPageId",
      pageId: input.parentPageId,
      pageTitle: input.parentPageTitle,
      siteUrl: input.siteUrl,
      spaceKey: input.spaceKey,
      titleLabel: "parentPageTitle",
    }),
  ]);

  if (page.pageId === parent.pageId) {
    throw new Error("A page cannot be moved under itself.");
  }

  const current = await confluenceGetPage({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    pageId: page.pageId,
  });
  const nextVersion = (current.version?.number ?? 0) + 1;
  const title = current.title ?? page.title;
  const storageHtml = current.body?.storage?.value ?? "<p></p>";

  const updated = await confluencePutPage({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    pageId: page.pageId,
    parentId: parent.pageId,
    storageHtml,
    title,
    versionNumber: nextVersion,
  });

  const result = confluencePageResult({
    fallbackPageId: page.pageId,
    fallbackTitle: title,
    page: updated,
    siteUrl: input.siteUrl,
  });

  return {
    ...result,
    parentPageId: parent.pageId,
  };
}
