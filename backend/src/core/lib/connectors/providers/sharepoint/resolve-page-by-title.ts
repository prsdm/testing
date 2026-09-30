import { parseSharePointCompositePageRef } from "@/core/lib/connectors/providers/sharepoint/page-id";
import { sharePointBrowsePagesInSite } from "@/core/lib/connectors/providers/sharepoint/read";

export type ResolvedSharePointPage = {
  siteId: string;
  pageId: string;
  title: string;
  link: string;
};

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function pickBestTitleMatch(
  pages: Array<{
    siteId: string;
    pageId: string;
    title: string;
    link: string;
  }>,
  title: string
): ResolvedSharePointPage | null {
  const normalizedTarget = normalizeTitle(title);
  const exact = pages.filter(
    (page) => normalizeTitle(page.title) === normalizedTarget
  );
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw new Error(
      `Multiple SharePoint pages match title "${title}". Provide pageId instead.`
    );
  }

  const contains = pages.filter((page) => {
    const normalizedPageTitle = normalizeTitle(page.title);
    return (
      normalizedPageTitle.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedPageTitle)
    );
  });
  if (contains.length === 1) {
    return contains[0];
  }
  if (contains.length > 1) {
    throw new Error(
      `Multiple SharePoint pages match title "${title}". Provide pageId instead.`
    );
  }
  if (pages.length === 1) {
    return pages[0];
  }
  return null;
}

export async function resolveSharePointPageRef(input: {
  accessToken: string;
  siteId: string;
  pageId?: string;
  pageTitle?: string;
}): Promise<ResolvedSharePointPage> {
  const trimmedId = input.pageId?.trim();
  const composite = trimmedId
    ? parseSharePointCompositePageRef(trimmedId)
    : null;
  if (composite) {
    return {
      link: "",
      pageId: composite.pageId,
      siteId: composite.siteId,
      title: trimmedId ?? composite.pageId,
    };
  }
  if (trimmedId) {
    return {
      link: "",
      pageId: trimmedId,
      siteId: input.siteId,
      title: trimmedId,
    };
  }

  const trimmedTitle = input.pageTitle?.trim();
  if (!trimmedTitle) {
    throw new Error("pageId or pageTitle is required.");
  }

  const { pages } = await sharePointBrowsePagesInSite({
    accessToken: input.accessToken,
    limit: 20,
    query: trimmedTitle,
    siteId: input.siteId,
  });
  const match = pickBestTitleMatch(pages, trimmedTitle);
  if (!match) {
    throw new Error(`No SharePoint page found for title "${trimmedTitle}".`);
  }
  return match;
}
