import {
  plainTextToInnerHtml,
  sharePointPageResult,
  sharePointPatchPage,
  sharePointPublishPage,
} from "@/core/lib/connectors/providers/sharepoint/api";
import { assertSharePointActionAllowed } from "@/core/lib/connectors/providers/sharepoint/auth";
import { sharePointGetPageContent } from "@/core/lib/connectors/providers/sharepoint/read";
import { resolveSharePointPageRef } from "@/core/lib/connectors/providers/sharepoint/resolve-page-by-title";
import { resolveSharePointSiteContext } from "@/core/lib/connectors/providers/sharepoint/resolve-site";

export async function sharePointUpdatePage(input: {
  tenantId: string;
  accessToken: string;
  siteId?: string;
  siteUrl?: string;
  siteName?: string;
  pageId?: string;
  pageTitle?: string;
  content: string;
  contentMode?: "append" | "replace";
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

  const content = input.content.trim();
  if (!content) {
    throw new Error("content is required.");
  }

  const { siteId } = await resolveSharePointSiteContext({
    accessToken: input.accessToken,
    pageId: input.pageId,
    siteId: input.siteId,
    siteName: input.siteName,
    siteUrl: input.siteUrl,
  });
  const page = await resolveSharePointPageRef({
    accessToken: input.accessToken,
    pageId: input.pageId,
    pageTitle: input.pageTitle,
    siteId,
  });

  const current = await sharePointGetPageContent({
    accessToken: input.accessToken,
    pageId: page.pageId,
    siteId: page.siteId,
  });

  const contentMode = input.contentMode ?? "append";
  const mergedText =
    contentMode === "replace"
      ? content
      : [current.content.trim(), content].filter(Boolean).join("\n\n");
  const innerHtml = plainTextToInnerHtml(mergedText);

  const updated = await sharePointPatchPage({
    accessToken: input.accessToken,
    innerHtml,
    pageId: page.pageId,
    siteId: page.siteId,
  });
  await sharePointPublishPage({
    accessToken: input.accessToken,
    pageId: page.pageId,
    siteId: page.siteId,
  });

  const link = updated.webUrl?.trim() || current.link;
  return sharePointPageResult({
    link,
    pageId: page.pageId,
    siteId: page.siteId,
    title: updated.title?.trim() || current.title,
  });
}
