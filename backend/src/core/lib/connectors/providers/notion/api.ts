export const NOTION_VERSION = "2026-03-11";

export type NotionPageParent =
  | { type: "workspace" }
  | { type: "page"; pageId: string };

export async function notionFetch(args: {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  accessToken: string;
  body?: unknown;
}) {
  const response = await fetch(`https://api.notion.com/v1${args.path}`, {
    body: args.body ? JSON.stringify(args.body) : undefined,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      "Notion-Version": NOTION_VERSION,
      ...(args.body ? { "content-type": "application/json" } : {}),
    },
    method: args.method ?? "GET",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Notion API ${args.path} failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
  return response;
}

export function buildPageParentPayload(parent: NotionPageParent) {
  if (parent.type === "workspace") {
    return { type: "workspace", workspace: true };
  }
  return { page_id: parent.pageId, type: "page_id" };
}

export function buildDataSourceParentPayload(dataSourceId: string) {
  return {
    data_source_id: dataSourceId,
    type: "data_source_id",
  };
}
