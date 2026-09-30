import type { NotionPageParent } from "@/core/lib/connectors/providers/notion/api";
import { resolveNotionPageId } from "@/core/lib/connectors/providers/notion/resolve-page-by-title";

export type NotionCreateParent = NotionPageParent;

export async function resolveNotionCreateParent(input: {
  accessToken: string;
  parentPageId?: string;
  parentPageTitle?: string;
}): Promise<NotionCreateParent> {
  const parentPageId = input.parentPageId?.trim();
  const parentPageTitle = input.parentPageTitle?.trim();
  if (!parentPageId && !parentPageTitle) {
    return { type: "workspace" };
  }
  const parent = await resolveNotionPageId({
    accessToken: input.accessToken,
    idLabel: "parentPageId",
    pageId: parentPageId,
    pageTitle: parentPageTitle,
    titleLabel: "parentPageTitle",
  });
  return { pageId: parent.pageId, type: "page" };
}
