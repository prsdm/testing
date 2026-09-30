import { CONFLUENCE_PARAMS } from "@/core/lib/connectors/providers/confluence/params";
import { GMAIL_PARAMS } from "@/core/lib/connectors/providers/gmail/params";
import { GOOGLE_CALENDAR_PARAMS } from "@/core/lib/connectors/providers/google-calendar/params";
import { GOOGLE_DRIVE_PARAMS } from "@/core/lib/connectors/providers/google-drive/params";
import { JIRA_PARAMS } from "@/core/lib/connectors/providers/jira/params";
import { NOTION_PARAMS } from "@/core/lib/connectors/providers/notion/params";
import { SHAREPOINT_PARAMS } from "@/core/lib/connectors/providers/sharepoint/params";
import { SLACK_PARAMS } from "@/core/lib/connectors/providers/slack/params";
import type { ToolParam } from "@/core/lib/connectors/providers/types";

const ALL_PARAMS: Record<string, ToolParam[]> = {
  ...CONFLUENCE_PARAMS,
  ...GOOGLE_DRIVE_PARAMS,
  ...GMAIL_PARAMS,
  ...GOOGLE_CALENDAR_PARAMS,
  ...NOTION_PARAMS,
  ...SHAREPOINT_PARAMS,
  ...SLACK_PARAMS,
  ...JIRA_PARAMS,
};

export function getToolParams(toolId: string): ToolParam[] {
  return ALL_PARAMS[toolId] ?? [];
}

export type { ToolParam } from "@/core/lib/connectors/providers/types";
