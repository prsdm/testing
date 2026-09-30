export { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
export { JIRA_PROVIDER_ID } from "@/core/lib/connectors/providers/jira/provider";
export { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
export { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
export { SLACK_PROVIDER_ID } from "@/core/lib/connectors/providers/slack/provider";
export { GMAIL_PROVIDER_ID } from "@/shared/connectors/providers/gmail/provider";
export { GOOGLE_CALENDAR_PROVIDER_ID } from "@/shared/connectors/providers/google-calendar/provider";
export { GOOGLE_DRIVE_PROVIDER_ID } from "@/shared/connectors/providers/google-drive/provider";

import { confluenceProvider } from "@/core/lib/connectors/providers/confluence/provider";
import { jiraProvider } from "@/core/lib/connectors/providers/jira/provider";
import { notionProvider } from "@/core/lib/connectors/providers/notion/provider";
import { sharePointProvider } from "@/core/lib/connectors/providers/sharepoint/provider";
import { slackProvider } from "@/core/lib/connectors/providers/slack/provider";
import type { Provider } from "@/core/lib/connectors/providers/types";
import { gmailProvider } from "@/shared/connectors/providers/gmail/provider";
import { googleCalendarProvider } from "@/shared/connectors/providers/google-calendar/provider";
import { googleDriveProvider } from "@/shared/connectors/providers/google-drive/provider";

const PROVIDERS: Provider[] = [
  googleDriveProvider,
  gmailProvider,
  googleCalendarProvider,
  confluenceProvider,
  notionProvider,
  sharePointProvider,
  slackProvider,
  jiraProvider,
];

export function listProviders(): Provider[] {
  return PROVIDERS;
}

export function getProviderById(providerId: string): Provider | undefined {
  return PROVIDERS.find((provider) => provider.id === providerId);
}

export function getToolsForProvider(
  providerId: string,
  provider?: Provider
): Provider["tools"] {
  const resolved = provider ?? getProviderById(providerId);
  return resolved?.tools ?? [];
}
