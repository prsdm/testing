import {
  buildPageParentPayload,
  notionFetch,
} from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import { parseContentToNotionBlocks } from "@/core/lib/connectors/providers/notion/blocks";
import { resolveNotionCreateParent } from "@/core/lib/connectors/providers/notion/resolve-create-parent";

export async function notionCreatePage(input: {
  tenantId: string;
  accessToken: string;
  parentPageId?: string;
  parentPageTitle?: string;
  title: string;
  content?: string;
}): Promise<{
  pageId: string;
  title: string;
  link: string;
  parentType: "workspace" | "page";
}> {
  await assertNotionActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });
  const parent = await resolveNotionCreateParent({
    accessToken: input.accessToken,
    parentPageId: input.parentPageId,
    parentPageTitle: input.parentPageTitle,
  });
  const title = input.title.trim() || "Untitled";
  const response = await notionFetch({
    accessToken: input.accessToken,
    body: {
      children: parseContentToNotionBlocks(input.content ?? ""),
      parent: buildPageParentPayload(parent),
      properties: {
        title: {
          title: [{ text: { content: title }, type: "text" }],
        },
      },
    },
    method: "POST",
    path: "/pages",
  });
  const created = (await response.json()) as {
    id?: string;
    url?: string;
  };
  if (!created.id || !created.url) {
    throw new Error("Notion did not return created page details.");
  }
  return {
    link: created.url,
    pageId: created.id,
    parentType: parent.type,
    title,
  };
}
