import {
  buildPageParentPayload,
  notionFetch,
} from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import { resolveNotionPageId } from "@/core/lib/connectors/providers/notion/resolve-page-by-title";

export async function notionMovePage(input: {
  tenantId: string;
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  parentPageId?: string;
  parentPageTitle?: string;
}): Promise<{
  pageId: string;
  title: string;
  link: string;
  parentPageId: string;
}> {
  await assertNotionActionAllowed({
    action: "write",
    tenantId: input.tenantId,
  });
  const [page, parent] = await Promise.all([
    resolveNotionPageId({
      accessToken: input.accessToken,
      pageId: input.pageId,
      pageTitle: input.pageTitle,
    }),
    resolveNotionPageId({
      accessToken: input.accessToken,
      idLabel: "parentPageId",
      pageId: input.parentPageId,
      pageTitle: input.parentPageTitle,
      titleLabel: "parentPageTitle",
    }),
  ]);

  if (page.pageId === parent.pageId) {
    throw new Error("A page cannot be moved under itself.");
  }

  const response = await notionFetch({
    accessToken: input.accessToken,
    body: {
      parent: buildPageParentPayload({
        pageId: parent.pageId,
        type: "page",
      }),
    },
    method: "POST",
    path: `/pages/${encodeURIComponent(page.pageId)}/move`,
  });
  const moved = (await response.json()) as {
    id?: string;
    url?: string;
  };
  if (!moved.id || !moved.url) {
    throw new Error("Notion did not return moved page details.");
  }

  return {
    link: moved.url,
    pageId: moved.id,
    parentPageId: parent.pageId,
    title: page.title,
  };
}
