import {
  confluenceGetPage,
  confluencePageResult,
  confluencePutPage,
} from "@/core/lib/connectors/providers/confluence/api";
import { assertConfluenceActionAllowed } from "@/core/lib/connectors/providers/confluence/auth";
import { resolveConfluencePageId } from "@/core/lib/connectors/providers/confluence/resolve-page-by-title";

export async function confluenceRenamePage(input: {
  tenantId: string;
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  spaceKey?: string;
  title: string;
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
  const nextTitle = input.title.trim();
  if (!nextTitle) {
    throw new Error("title is required.");
  }

  const current = await confluenceGetPage({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    pageId: page.pageId,
  });
  const nextVersion = (current.version?.number ?? 0) + 1;
  const storageHtml = current.body?.storage?.value ?? "<p></p>";

  const updated = await confluencePutPage({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    pageId: page.pageId,
    storageHtml,
    title: nextTitle,
    versionNumber: nextVersion,
  });

  return confluencePageResult({
    fallbackPageId: page.pageId,
    fallbackTitle: nextTitle,
    page: updated,
    siteUrl: input.siteUrl,
  });
}
