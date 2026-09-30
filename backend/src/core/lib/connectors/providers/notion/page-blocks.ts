import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { parseContentToNotionBlocks } from "@/core/lib/connectors/providers/notion/blocks";

type NotionBlockRef = { id: string; type?: string };

export async function listTopLevelBlockIds(input: {
  accessToken: string;
  pageId: string;
}) {
  const blockIds: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ page_size: "100" });
    if (cursor) {
      params.set("start_cursor", cursor);
    }
    const response = await notionFetch({
      accessToken: input.accessToken,
      path: `/blocks/${encodeURIComponent(input.pageId)}/children?${params.toString()}`,
    });
    const payload = (await response.json()) as {
      results?: NotionBlockRef[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    for (const block of payload.results ?? []) {
      blockIds.push(block.id);
    }
    if (!payload.has_more || !payload.next_cursor) {
      break;
    }
    cursor = payload.next_cursor;
  }

  return blockIds;
}

export async function archiveBlocks(input: {
  accessToken: string;
  blockIds: string[];
}) {
  for (const blockId of input.blockIds) {
    await notionFetch({
      accessToken: input.accessToken,
      body: { archived: true },
      method: "PATCH",
      path: `/blocks/${encodeURIComponent(blockId)}`,
    });
  }
}

export async function applyPageContent(input: {
  accessToken: string;
  pageId: string;
  content: string;
  contentMode?: "append" | "replace";
}) {
  const mode = input.contentMode ?? "append";
  if (mode === "replace") {
    const blockIds = await listTopLevelBlockIds({
      accessToken: input.accessToken,
      pageId: input.pageId,
    });
    await archiveBlocks({
      accessToken: input.accessToken,
      blockIds,
    });
  }
  await notionFetch({
    accessToken: input.accessToken,
    body: {
      children: parseContentToNotionBlocks(input.content),
    },
    method: "PATCH",
    path: `/blocks/${encodeURIComponent(input.pageId)}/children`,
  });
}
