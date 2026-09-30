import {
  confluencePageResult,
  confluencePostPage,
  resolveConfluenceSpaceId,
} from "@/core/lib/connectors/providers/confluence/api";
import { assertConfluenceActionAllowed } from "@/core/lib/connectors/providers/confluence/auth";
import { resolveConfluencePageId } from "@/core/lib/connectors/providers/confluence/resolve-page-by-title";
import { toStorageHtml } from "@/core/lib/connectors/providers/confluence/storage-html";

export async function confluenceCreatePage(input: {
  tenantId: string;
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  spaceKey: string;
  title: string;
  content: string;
  parentPageId?: string;
  parentPageTitle?: string;
}): Promise<{ pageId: string; title: string; link: string }> {
  await assertConfluenceActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });

  const spaceKey = input.spaceKey.trim();
  if (!spaceKey) {
    throw new Error("spaceKey is required.");
  }

  const [spaceId, parentPageId] = await Promise.all([
    resolveConfluenceSpaceId({
      accessToken: input.accessToken,
      cloudId: input.cloudId,
      spaceKey,
    }),
    (async () => {
      const trimmedParentId = input.parentPageId?.trim();
      if (trimmedParentId) {
        return trimmedParentId;
      }
      if (!input.parentPageTitle?.trim()) {
        return;
      }
      const parent = await resolveConfluencePageId({
        accessToken: input.accessToken,
        cloudId: input.cloudId,
        idLabel: "parentPageId",
        pageTitle: input.parentPageTitle,
        siteUrl: input.siteUrl,
        spaceKey,
        titleLabel: "parentPageTitle",
      });
      return parent.pageId;
    })(),
  ]);

  const title = input.title.trim() || "Untitled";
  const created = await confluencePostPage({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    parentId: parentPageId,
    spaceId,
    storageHtml: toStorageHtml(input.content),
    title,
  });
  if (!created.id) {
    throw new Error("Confluence did not return created page id.");
  }
  return confluencePageResult({
    fallbackPageId: created.id,
    fallbackTitle: title,
    page: created,
    siteUrl: input.siteUrl,
  });
}
