import { parseConfluencePageId } from "@/core/lib/connectors/providers/confluence/page-id";
import { confluenceBrowsePages } from "@/core/lib/connectors/providers/confluence/read";

export type ResolvedConfluencePage = {
  pageId: string;
  title: string;
  link: string;
};

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function pickBestTitleMatch(
  pages: Array<{ pageId: string; title: string; link: string }>,
  title: string
): ResolvedConfluencePage | null {
  const normalizedTarget = normalizeTitle(title);
  const exact = pages.filter(
    (page) => normalizeTitle(page.title) === normalizedTarget
  );
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw new Error(
      `Multiple Confluence pages match title "${title}". Provide spaceKey or pageId instead.`
    );
  }

  const startsWith = pages.filter((page) =>
    normalizeTitle(page.title).startsWith(normalizedTarget)
  );
  if (startsWith.length === 1) {
    return startsWith[0];
  }
  if (startsWith.length > 1) {
    throw new Error(
      `Multiple Confluence pages match title "${title}". Provide spaceKey or pageId instead.`
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
      `Multiple Confluence pages match title "${title}". Provide spaceKey or pageId instead.`
    );
  }

  if (pages.length === 1) {
    return pages[0];
  }
  if (pages.length > 1) {
    throw new Error(
      `Multiple Confluence pages match title "${title}". Provide spaceKey or pageId instead.`
    );
  }

  return null;
}

async function browseAccessiblePages(input: {
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  spaceKey?: string;
}) {
  const pages: Array<{ pageId: string; title: string; link: string }> = [];
  let cursor: string | undefined;

  while (pages.length < 100) {
    const batch = await confluenceBrowsePages({
      accessToken: input.accessToken,
      cloudId: input.cloudId,
      cursor,
      limit: 50,
      siteUrl: input.siteUrl,
      spaceKey: input.spaceKey,
    });
    pages.push(...batch.pages);
    if (!batch.nextCursor) {
      break;
    }
    cursor = batch.nextCursor;
  }

  return pages;
}

export async function resolveConfluencePageId(input: {
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  spaceKey?: string;
  idLabel?: string;
  titleLabel?: string;
}): Promise<ResolvedConfluencePage> {
  const trimmedId = input.pageId?.trim();
  const parsedId = trimmedId ? parseConfluencePageId(trimmedId) : null;
  if (parsedId) {
    return { link: "", pageId: parsedId, title: trimmedId ?? parsedId };
  }

  const trimmedTitle = input.pageTitle?.trim();
  const idLabel = input.idLabel ?? "pageId";
  const titleLabel = input.titleLabel ?? "pageTitle";
  if (!trimmedTitle) {
    throw new Error(`${idLabel} or ${titleLabel} is required.`);
  }

  const { pages: searchResults } = await confluenceBrowsePages({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    limit: 20,
    query: trimmedTitle,
    siteUrl: input.siteUrl,
    spaceKey: input.spaceKey,
  });
  let match = pickBestTitleMatch(searchResults, trimmedTitle);

  if (!match) {
    const accessiblePages = await browseAccessiblePages({
      accessToken: input.accessToken,
      cloudId: input.cloudId,
      siteUrl: input.siteUrl,
      spaceKey: input.spaceKey,
    });
    match = pickBestTitleMatch(accessiblePages, trimmedTitle);
    if (!match) {
      throw new Error(`No Confluence page found for title "${trimmedTitle}".`);
    }
  }

  return match;
}
