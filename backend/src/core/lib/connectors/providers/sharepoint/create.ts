import {
  plainTextToInnerHtml,
  sharePointCreatePageGraph,
  sharePointPageResult,
  sharePointPublishPage,
  slugifySharePointPageName,
} from "@/core/lib/connectors/providers/sharepoint/api";
import { assertSharePointActionAllowed } from "@/core/lib/connectors/providers/sharepoint/auth";
import { resolveSharePointSiteId } from "@/core/lib/connectors/providers/sharepoint/resolve-site";

export async function sharePointCreatePage(input: {
  tenantId: string;
  accessToken: string;
  siteId?: string;
  siteUrl?: string;
  siteName?: string;
  title: string;
  content: string;
}): Promise<{
  siteId: string;
  pageId: string;
  title: string;
  link: string;
  externalRef: string;
}> {
  await assertSharePointActionAllowed({
    action: "write",
    tenantId: input.tenantId,
  });

  if (
    !input.siteId?.trim() &&
    !input.siteUrl?.trim() &&
    !input.siteName?.trim()
  ) {
    throw new Error("siteId, siteUrl, or siteName is required.");
  }

  const { siteId } = await resolveSharePointSiteId({
    accessToken: input.accessToken,
    siteId: input.siteId,
    siteName: input.siteName,
    siteUrl: input.siteUrl,
  });

  const title = input.title.trim() || "Untitled";
  const created = await sharePointCreatePageGraph({
    accessToken: input.accessToken,
    innerHtml: plainTextToInnerHtml(input.content),
    name: slugifySharePointPageName(title),
    siteId,
    title,
  });
  if (!created.id) {
    throw new Error("SharePoint did not return created page id.");
  }
  const pageId = created.id;
  await sharePointPublishPage({
    accessToken: input.accessToken,
    pageId,
    siteId,
  });

  const link = created.webUrl?.trim() ?? "";
  if (!link) {
    throw new Error("SharePoint did not return page link.");
  }

  return sharePointPageResult({
    link,
    pageId,
    siteId,
    title: created.title?.trim() || title,
  });
}
