import {
  buildPageParentPayload,
  type NotionPageParent,
} from "@/core/lib/connectors/providers/notion/api";

export function buildNotionDatabaseCreateBody(input: {
  parent: NotionPageParent;
  title: string;
  properties: Record<string, unknown>;
}) {
  return {
    initial_data_source: {
      properties: input.properties,
    },
    parent: buildPageParentPayload(input.parent),
    title: [{ text: { content: input.title }, type: "text" }],
  };
}
