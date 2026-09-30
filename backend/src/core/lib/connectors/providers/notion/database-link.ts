import { notionFetch } from "@/core/lib/connectors/providers/notion/api";

export async function notionGetDatabaseLink(args: {
  accessToken: string;
  databaseId: string;
}): Promise<string | null> {
  const databaseId = args.databaseId.trim();
  if (!databaseId) {
    return null;
  }

  const response = await notionFetch({
    accessToken: args.accessToken,
    path: `/databases/${encodeURIComponent(databaseId)}`,
  }).catch(() => null);
  if (!response) {
    return null;
  }

  const payload = (await response.json()) as { url?: string };
  const link = payload.url?.trim();
  return link || null;
}
