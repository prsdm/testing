import { notionBrowseDatabases } from "@/core/lib/connectors/providers/notion/browse-databases";
import {
  parseNotionId,
  slugLikeIdToTitle,
} from "@/core/lib/connectors/providers/notion/notion-id";

export type ResolvedNotionDatabase = {
  databaseId: string;
  title: string;
};

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function pickBestDatabaseTitleMatch(
  databases: ResolvedNotionDatabase[],
  title: string
): ResolvedNotionDatabase | null {
  const normalizedTarget = normalizeTitle(title);
  const exact = databases.filter(
    (database) => normalizeTitle(database.title) === normalizedTarget
  );
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw new Error(
      `Multiple Notion databases match title "${title}". Provide databaseId instead.`
    );
  }

  const contains = databases.filter((database) => {
    const normalizedTitle = normalizeTitle(database.title);
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
      `Multiple Notion databases match title "${title}". Provide databaseId instead.`
    );
  }

  if (databases.length === 1) {
    return databases[0];
  }
  if (databases.length > 1) {
    throw new Error(
      `Multiple Notion databases match title "${title}". Provide databaseId instead.`
    );
  }

  return null;
}

export async function resolveNotionDatabaseId(input: {
  accessToken: string;
  databaseId?: string;
  databaseTitle?: string;
}): Promise<ResolvedNotionDatabase> {
  const trimmedId = input.databaseId?.trim();
  const parsedId = trimmedId ? parseNotionId(trimmedId) : null;
  if (parsedId) {
    return { databaseId: parsedId, title: trimmedId ?? parsedId };
  }

  let trimmedTitle = input.databaseTitle?.trim();
  if (trimmedId && !trimmedTitle) {
    trimmedTitle = slugLikeIdToTitle(trimmedId);
  }
  if (!trimmedTitle) {
    throw new Error("databaseId or databaseTitle is required.");
  }

  let { databases } = await notionBrowseDatabases({
    accessToken: input.accessToken,
    limit: 20,
    query: trimmedTitle,
  });
  let match = pickBestDatabaseTitleMatch(databases, trimmedTitle);
  if (!match) {
    ({ databases } = await notionBrowseDatabases({
      accessToken: input.accessToken,
      limit: 100,
    }));
    match = pickBestDatabaseTitleMatch(databases, trimmedTitle);
  }
  if (!match) {
    throw new Error(
      `No Notion database found for title "${trimmedTitle}". Share the database with this connection in Notion (••• → Connections).`
    );
  }
  return match;
}
