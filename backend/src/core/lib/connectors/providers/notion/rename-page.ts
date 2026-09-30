import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import {
  buildTitlePropertyValue,
  findTitlePropertyKey,
} from "@/core/lib/connectors/providers/notion/properties";
import { resolveNotionPageId } from "@/core/lib/connectors/providers/notion/resolve-page-by-title";

export async function notionRenamePage(input: {
  tenantId: string;
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  title: string;
}): Promise<{ pageId: string; title: string; link: string }> {
  await assertNotionActionAllowed({
    action: "write",
    tenantId: input.tenantId,
  });
  const page = await resolveNotionPageId({
    accessToken: input.accessToken,
    pageId: input.pageId,
    pageTitle: input.pageTitle,
  });
  const nextTitle = input.title.trim();
  if (!nextTitle) {
    throw new Error("title is required.");
  }

  const pageResponse = await notionFetch({
    accessToken: input.accessToken,
    path: `/pages/${encodeURIComponent(page.pageId)}`,
  });
  const pagePayload = (await pageResponse.json()) as {
    id?: string;
    url?: string;
    properties?: Record<string, unknown>;
  };
  if (!pagePayload.id || !pagePayload.url) {
    throw new Error("Notion page not found.");
  }

  const titleKey = findTitlePropertyKey(pagePayload.properties ?? {});
  await notionFetch({
    accessToken: input.accessToken,
    body: {
      properties: {
        [titleKey]: buildTitlePropertyValue(nextTitle),
      },
    },
    method: "PATCH",
    path: `/pages/${encodeURIComponent(page.pageId)}`,
  });

  return {
    link: pagePayload.url,
    pageId: pagePayload.id,
    title: nextTitle,
  };
}
