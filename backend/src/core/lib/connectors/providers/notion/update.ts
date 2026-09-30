import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import { applyPageContent } from "@/core/lib/connectors/providers/notion/page-blocks";
import { resolveNotionPageId } from "@/core/lib/connectors/providers/notion/resolve-page-by-title";

export async function notionUpdatePage(input: {
  tenantId: string;
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  content: string;
  contentMode?: "append" | "replace";
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
  const content = input.content.trim();
  if (!content) {
    throw new Error("content is required.");
  }

  const pageResponse = await notionFetch({
    accessToken: input.accessToken,
    path: `/pages/${encodeURIComponent(page.pageId)}`,
  });
  const pagePayload = (await pageResponse.json()) as {
    id?: string;
    url?: string;
  };
  if (!pagePayload.id || !pagePayload.url) {
    throw new Error("Notion page not found.");
  }

  await applyPageContent({
    accessToken: input.accessToken,
    content,
    contentMode: input.contentMode,
    pageId: page.pageId,
  });

  return {
    link: pagePayload.url,
    pageId: pagePayload.id,
    title: page.title,
  };
}
