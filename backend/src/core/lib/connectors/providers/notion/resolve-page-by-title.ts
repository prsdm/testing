import {
  parseNotionId,
  slugLikeIdToTitle,
} from "@/core/lib/connectors/providers/notion/notion-id";
import { notionBrowsePages } from "@/core/lib/connectors/providers/notion/read";

export type ResolvedNotionPage = {
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
): ResolvedNotionPage | null {
  const normalizedTarget = normalizeTitle(title);
  const exact = pages.filter(
    (page) => normalizeTitle(page.title) === normalizedTarget
  );
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw new Error(
      `Multiple Notion pages match title "${title}". Provide parentPageId or pageId instead.`
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
      `Multiple Notion pages match title "${title}". Provide parentPageId or pageId instead.`
    );
  }

  const contains = pages.filter((page) => {
    const normalizedTitle = normalizeTitle(page.title);
    return (
      normalizedTitle.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedTitle)
    );
  });
  if (contains.length === 1) {
    return contains[0];
  }
  if (contains.length > 1) {
    throw new Error(
      `Multiple Notion pages match title "${title}". Provide parentPageId or pageId instead.`
    );
  }

  if (pages.length === 1) {
    return pages[0];
  }
  if (pages.length > 1) {
    throw new Error(
      `Multiple Notion pages match title "${title}". Provide parentPageId or pageId instead.`
    );
  }

  return null;
}

function formatNotionPageNotFoundError(
  title: string,
  accessibleTitles: string[]
) {
  const base = `No Notion page found for title "${title}".`;
  const sharingHint =
    "Notion only exposes pages shared with this connection — open the page in Notion → ••• → Connections → add this app, or paste the page URL as parentPageId.";
  if (accessibleTitles.length === 0) {
    return `${base} ${sharingHint}`;
  }
  const sample = accessibleTitles.slice(0, 5).join('", "');
  const suffix =
    accessibleTitles.length > 5
      ? `", … (${accessibleTitles.length} accessible pages total)`
      : '"';
  return `${base} Accessible pages include: "${sample}${suffix}. ${sharingHint}`;
}

async function browseAccessiblePages(accessToken: string) {
  const pages: Array<{ pageId: string; title: string; link: string }> = [];
  let cursor: string | undefined;

  while (pages.length < 100) {
    const batch = await notionBrowsePages({
      accessToken,
      limit: 100,
      startCursor: cursor,
    });
    pages.push(...batch.pages);
    if (!batch.nextCursor) {
      break;
    }
    cursor = batch.nextCursor;
  }

  return pages;
}

export async function resolveNotionPageId(input: {
  accessToken: string;
  pageId?: string;
  pageTitle?: string;
  idLabel?: string;
  titleLabel?: string;
}): Promise<ResolvedNotionPage> {
  const trimmedId = input.pageId?.trim();
  const parsedId = trimmedId ? parseNotionId(trimmedId) : null;
  if (parsedId) {
    return { link: "", pageId: parsedId, title: trimmedId ?? parsedId };
  }

  let trimmedTitle = input.pageTitle?.trim();
  if (trimmedId && !trimmedTitle) {
    trimmedTitle = slugLikeIdToTitle(trimmedId);
  }

  const idLabel = input.idLabel ?? "pageId";
  const titleLabel = input.titleLabel ?? "pageTitle";
  if (!trimmedTitle) {
    throw new Error(`${idLabel} or ${titleLabel} is required.`);
  }

  const { pages: searchResults } = await notionBrowsePages({
    accessToken: input.accessToken,
    limit: 20,
    query: trimmedTitle,
  });
  let match = pickBestTitleMatch(searchResults, trimmedTitle);

  if (!match) {
    const accessiblePages = await browseAccessiblePages(input.accessToken);
    match = pickBestTitleMatch(accessiblePages, trimmedTitle);
    if (!match) {
      const titles = accessiblePages.map((page) => page.title);
      throw new Error(formatNotionPageNotFoundError(trimmedTitle, titles));
    }
  }

  return match;
}
