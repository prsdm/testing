import {
  sharePointPageResult,
  sharePointPatchPage,
  sharePointPublishPage,
} from "@/core/lib/connectors/providers/sharepoint/api";
import { assertSharePointActionAllowed } from "@/core/lib/connectors/providers/sharepoint/auth";
import { sharePointGetPageContent } from "@/core/lib/connectors/providers/sharepoint/read";
import { resolveSharePointPageRef } from "@/core/lib/connectors/providers/sharepoint/resolve-page-by-title";
import { resolveSharePointSiteContext } from "@/core/lib/connectors/providers/sharepoint/resolve-site";

export async function sharePointRenamePage(input: {
  tenantId: string;
  accessToken: string;
  siteId?: string;
  siteUrl?: string;
  siteName?: string;
  pageId?: string;
  pageTitle?: string;
  title: string;
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

  const nextTitle = input.title.trim();
  if (!nextTitle) {
    throw new Error("title is required.");
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

  const updated = await sharePointPatchPage({
    accessToken: input.accessToken,
    pageId: page.pageId,
    siteId: page.siteId,
    title: nextTitle,
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
    title: updated.title?.trim() || nextTitle,
  });
}
