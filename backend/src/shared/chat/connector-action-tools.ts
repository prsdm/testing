import type { ConnectorProvider } from "@/contracts/connectors";
import type { ChatMessagePart } from "@/shared/types";

export type SlackUserLookup = Map<string, string>;

export const CONNECTION_ACTION_TOOL_TYPES = new Set([
  "tool-driveListFolders",
  "tool-driveSearchFiles",
  "tool-driveGetFile",
  "tool-driveCreateFolder",
  "tool-driveCreateSharedDrive",
  "tool-driveUploadFile",
  "tool-driveMoveFile",
  "tool-driveUpdateFile",
  "tool-gmailListMessages",
  "tool-gmailSearchMessages",
  "tool-gmailGetMessage",
  "tool-gmailGetThread",
  "tool-gmailSendMessage",
  "tool-gmailCreateDraft",
  "tool-gmailSendDraft",
  "tool-gmailReplyToMessage",
  "tool-googleCalendarListCalendars",
  "tool-googleCalendarListEvents",
  "tool-googleCalendarGetEvent",
  "tool-googleCalendarCreateEvent",
  "tool-googleCalendarUpdateEvent",
  "tool-googleCalendarDeleteEvent",
  "tool-notionCreatePage",
  "tool-notionCreateDatabase",
  "tool-notionRenamePage",
  "tool-notionUpdatePage",
  "tool-notionMovePage",
  "tool-notionDbCreateRow",
  "tool-notionDbRenameRow",
  "tool-notionDbUpdateRow",
  "tool-notionDbMoveRow",
  "tool-confluenceCreateSpace",
  "tool-confluenceCreatePage",
  "tool-confluenceRenamePage",
  "tool-confluenceUpdatePage",
  "tool-confluenceMovePage",
  "tool-sharePointCreatePage",
  "tool-sharePointRenamePage",
  "tool-sharePointUpdatePage",
  "tool-slackListChannels",
  "tool-slackListUsers",
  "tool-slackSearchMessages",
  "tool-slackGetConversationHistory",
  "tool-slackGetDirectMessageHistory",
  "tool-slackGetThreadReplies",
  "tool-slackPostMessage",
  "tool-slackPostDirectMessage",
  "tool-slackUpdateMessage",
  "tool-slackCreateChannel",
  "tool-jiraListProjects",
  "tool-jiraSearchIssues",
  "tool-jiraGetIssue",
  "tool-jiraCreateIssue",
  "tool-jiraUpdateIssue",
  "tool-jiraListTransitions",
  "tool-jiraTransitionIssue",
  "tool-jiraAddComment",
]);

export type ConnectorActionToolType =
  | "tool-driveListFolders"
  | "tool-driveSearchFiles"
  | "tool-driveGetFile"
  | "tool-driveCreateFolder"
  | "tool-driveCreateSharedDrive"
  | "tool-driveUploadFile"
  | "tool-driveMoveFile"
  | "tool-driveUpdateFile"
  | "tool-gmailListMessages"
  | "tool-gmailSearchMessages"
  | "tool-gmailGetMessage"
  | "tool-gmailGetThread"
  | "tool-gmailSendMessage"
  | "tool-gmailCreateDraft"
  | "tool-gmailSendDraft"
  | "tool-gmailReplyToMessage"
  | "tool-googleCalendarListCalendars"
  | "tool-googleCalendarListEvents"
  | "tool-googleCalendarGetEvent"
  | "tool-googleCalendarCreateEvent"
  | "tool-googleCalendarUpdateEvent"
  | "tool-googleCalendarDeleteEvent"
  | "tool-notionCreatePage"
  | "tool-notionCreateDatabase"
  | "tool-notionRenamePage"
  | "tool-notionUpdatePage"
  | "tool-notionMovePage"
  | "tool-notionDbCreateRow"
  | "tool-notionDbRenameRow"
  | "tool-notionDbUpdateRow"
  | "tool-notionDbMoveRow"
  | "tool-confluenceCreateSpace"
  | "tool-confluenceCreatePage"
  | "tool-confluenceRenamePage"
  | "tool-confluenceUpdatePage"
  | "tool-confluenceMovePage"
  | "tool-sharePointCreatePage"
  | "tool-sharePointRenamePage"
  | "tool-sharePointUpdatePage"
  | "tool-slackListChannels"
  | "tool-slackListUsers"
  | "tool-slackSearchMessages"
  | "tool-slackGetConversationHistory"
  | "tool-slackGetDirectMessageHistory"
  | "tool-slackGetThreadReplies"
  | "tool-slackPostMessage"
  | "tool-slackPostDirectMessage"
  | "tool-slackUpdateMessage"
  | "tool-slackCreateChannel"
  | "tool-jiraListProjects"
  | "tool-jiraSearchIssues"
  | "tool-jiraGetIssue"
  | "tool-jiraCreateIssue"
  | "tool-jiraUpdateIssue"
  | "tool-jiraListTransitions"
  | "tool-jiraTransitionIssue"
  | "tool-jiraAddComment";

type ConnectionActionToolMeta = {
  title: string;
  pendingLabel: string;
  streamingLabel: string;
  provider: ConnectorProvider;
};

const CONNECTION_ACTION_TOOL_META: Record<
  ConnectorActionToolType,
  ConnectionActionToolMeta
> = {
  "tool-confluenceCreatePage": {
    pendingLabel: "Creating Confluence page…",
    provider: "confluence",
    streamingLabel: "Creating Confluence page",
    title: "Creating Confluence page",
  },
  "tool-confluenceCreateSpace": {
    pendingLabel: "Creating Confluence space…",
    provider: "confluence",
    streamingLabel: "Creating Confluence space",
    title: "Creating Confluence space",
  },
  "tool-confluenceMovePage": {
    pendingLabel: "Moving Confluence page…",
    provider: "confluence",
    streamingLabel: "Moving Confluence page",
    title: "Moving Confluence page",
  },
  "tool-confluenceRenamePage": {
    pendingLabel: "Renaming Confluence page…",
    provider: "confluence",
    streamingLabel: "Renaming Confluence page",
    title: "Renaming Confluence page",
  },
  "tool-confluenceUpdatePage": {
    pendingLabel: "Updating Confluence page…",
    provider: "confluence",
    streamingLabel: "Updating Confluence page",
    title: "Updating Confluence page",
  },
  "tool-driveCreateFolder": {
    pendingLabel: "Creating Drive folder…",
    provider: "google-drive",
    streamingLabel: "Creating Drive folder",
    title: "Creating Drive folder",
  },
  "tool-driveCreateSharedDrive": {
    pendingLabel: "Creating shared drive…",
    provider: "google-drive",
    streamingLabel: "Creating shared drive",
    title: "Creating shared drive",
  },
  "tool-driveGetFile": {
    pendingLabel: "Reading Drive file…",
    provider: "google-drive",
    streamingLabel: "Reading Drive file",
    title: "Reading Drive file",
  },
  "tool-driveListFolders": {
    pendingLabel: "Listing Drive folders…",
    provider: "google-drive",
    streamingLabel: "Listing Drive folders",
    title: "Listing Drive folders",
  },
  "tool-driveMoveFile": {
    pendingLabel: "Moving Drive file…",
    provider: "google-drive",
    streamingLabel: "Moving Drive file",
    title: "Moving Drive file",
  },
  "tool-driveSearchFiles": {
    pendingLabel: "Searching Drive…",
    provider: "google-drive",
    streamingLabel: "Searching Drive",
    title: "Searching Drive",
  },
  "tool-driveUpdateFile": {
    pendingLabel: "Updating Drive file…",
    provider: "google-drive",
    streamingLabel: "Updating Drive file",
    title: "Updating Drive file",
  },
  "tool-driveUploadFile": {
    pendingLabel: "Creating Drive file…",
    provider: "google-drive",
    streamingLabel: "Creating Drive file",
    title: "Creating Drive file",
  },
  "tool-gmailCreateDraft": {
    pendingLabel: "Creating email draft…",
    provider: "gmail",
    streamingLabel: "Creating email draft",
    title: "Creating email draft",
  },
  "tool-gmailGetMessage": {
    pendingLabel: "Reading Gmail message…",
    provider: "gmail",
    streamingLabel: "Reading Gmail message",
    title: "Reading Gmail message",
  },
  "tool-gmailGetThread": {
    pendingLabel: "Reading Gmail thread…",
    provider: "gmail",
    streamingLabel: "Reading Gmail thread",
    title: "Reading Gmail thread",
  },
  "tool-gmailListMessages": {
    pendingLabel: "Listing Gmail messages…",
    provider: "gmail",
    streamingLabel: "Listing Gmail messages",
    title: "Listing Gmail messages",
  },
  "tool-gmailReplyToMessage": {
    pendingLabel: "Replying to email…",
    provider: "gmail",
    streamingLabel: "Replying to email",
    title: "Replying to email",
  },
  "tool-gmailSearchMessages": {
    pendingLabel: "Searching Gmail…",
    provider: "gmail",
    streamingLabel: "Searching Gmail",
    title: "Searching Gmail",
  },
  "tool-gmailSendDraft": {
    pendingLabel: "Sending email draft…",
    provider: "gmail",
    streamingLabel: "Sending email draft",
    title: "Sending email draft",
  },
  "tool-gmailSendMessage": {
    pendingLabel: "Sending email…",
    provider: "gmail",
    streamingLabel: "Sending email",
    title: "Sending email",
  },
  "tool-googleCalendarCreateEvent": {
    pendingLabel: "Creating calendar event…",
    provider: "google-calendar",
    streamingLabel: "Creating calendar event",
    title: "Creating calendar event",
  },
  "tool-googleCalendarDeleteEvent": {
    pendingLabel: "Deleting calendar event…",
    provider: "google-calendar",
    streamingLabel: "Deleting calendar event",
    title: "Deleting calendar event",
  },
  "tool-googleCalendarGetEvent": {
    pendingLabel: "Reading calendar event…",
    provider: "google-calendar",
    streamingLabel: "Reading calendar event",
    title: "Reading calendar event",
  },
  "tool-googleCalendarListCalendars": {
    pendingLabel: "Listing Google calendars…",
    provider: "google-calendar",
    streamingLabel: "Listing Google calendars",
    title: "Listing Google calendars",
  },
  "tool-googleCalendarListEvents": {
    pendingLabel: "Listing calendar events…",
    provider: "google-calendar",
    streamingLabel: "Listing calendar events",
    title: "Listing calendar events",
  },
  "tool-googleCalendarUpdateEvent": {
    pendingLabel: "Updating calendar event…",
    provider: "google-calendar",
    streamingLabel: "Updating calendar event",
    title: "Updating calendar event",
  },
  "tool-jiraAddComment": {
    pendingLabel: "Adding Jira comment…",
    provider: "jira",
    streamingLabel: "Adding Jira comment",
    title: "Adding Jira comment",
  },
  "tool-jiraCreateIssue": {
    pendingLabel: "Creating Jira issue…",
    provider: "jira",
    streamingLabel: "Creating Jira issue",
    title: "Creating Jira issue",
  },
  "tool-jiraGetIssue": {
    pendingLabel: "Reading Jira issue…",
    provider: "jira",
    streamingLabel: "Reading Jira issue",
    title: "Reading Jira issue",
  },
  "tool-jiraListProjects": {
    pendingLabel: "Listing Jira projects…",
    provider: "jira",
    streamingLabel: "Listing Jira knowledgeBases",
    title: "Listing Jira knowledgeBases",
  },
  "tool-jiraListTransitions": {
    pendingLabel: "Listing Jira transitions…",
    provider: "jira",
    streamingLabel: "Listing Jira transitions",
    title: "Listing Jira transitions",
  },
  "tool-jiraSearchIssues": {
    pendingLabel: "Searching Jira…",
    provider: "jira",
    streamingLabel: "Searching Jira",
    title: "Searching Jira",
  },
  "tool-jiraTransitionIssue": {
    pendingLabel: "Transitioning Jira issue…",
    provider: "jira",
    streamingLabel: "Transitioning Jira issue",
    title: "Transitioning Jira issue",
  },
  "tool-jiraUpdateIssue": {
    pendingLabel: "Updating Jira issue…",
    provider: "jira",
    streamingLabel: "Updating Jira issue",
    title: "Updating Jira issue",
  },
  "tool-notionCreateDatabase": {
    pendingLabel: "Creating Notion database…",
    provider: "notion",
    streamingLabel: "Creating Notion database",
    title: "Creating Notion database",
  },
  "tool-notionCreatePage": {
    pendingLabel: "Creating Notion page…",
    provider: "notion",
    streamingLabel: "Creating Notion page",
    title: "Creating Notion page",
  },
  "tool-notionDbCreateRow": {
    pendingLabel: "Creating Notion database row…",
    provider: "notion",
    streamingLabel: "Creating Notion database row",
    title: "Creating Notion database row",
  },
  "tool-notionDbMoveRow": {
    pendingLabel: "Moving Notion database row…",
    provider: "notion",
    streamingLabel: "Moving Notion database row",
    title: "Moving Notion database row",
  },
  "tool-notionDbRenameRow": {
    pendingLabel: "Renaming Notion database row…",
    provider: "notion",
    streamingLabel: "Renaming Notion database row",
    title: "Renaming Notion database row",
  },
  "tool-notionDbUpdateRow": {
    pendingLabel: "Updating Notion database row…",
    provider: "notion",
    streamingLabel: "Updating Notion database row",
    title: "Updating Notion database row",
  },
  "tool-notionMovePage": {
    pendingLabel: "Moving Notion page…",
    provider: "notion",
    streamingLabel: "Moving Notion page",
    title: "Moving Notion page",
  },
  "tool-notionRenamePage": {
    pendingLabel: "Renaming Notion page…",
    provider: "notion",
    streamingLabel: "Renaming Notion page",
    title: "Renaming Notion page",
  },
  "tool-notionUpdatePage": {
    pendingLabel: "Updating Notion page…",
    provider: "notion",
    streamingLabel: "Updating Notion page",
    title: "Updating Notion page",
  },
  "tool-sharePointCreatePage": {
    pendingLabel: "Creating SharePoint page…",
    provider: "sharepoint",
    streamingLabel: "Creating SharePoint page",
    title: "Creating SharePoint page",
  },
  "tool-sharePointRenamePage": {
    pendingLabel: "Renaming SharePoint page…",
    provider: "sharepoint",
    streamingLabel: "Renaming SharePoint page",
    title: "Renaming SharePoint page",
  },
  "tool-sharePointUpdatePage": {
    pendingLabel: "Updating SharePoint page…",
    provider: "sharepoint",
    streamingLabel: "Updating SharePoint page",
    title: "Updating SharePoint page",
  },
  "tool-slackCreateChannel": {
    pendingLabel: "Creating Slack channel…",
    provider: "slack",
    streamingLabel: "Creating Slack channel",
    title: "Creating Slack channel",
  },
  "tool-slackGetConversationHistory": {
    pendingLabel: "Reading Slack history…",
    provider: "slack",
    streamingLabel: "Reading Slack history",
    title: "Reading Slack history",
  },
  "tool-slackGetDirectMessageHistory": {
    pendingLabel: "Reading Slack DM history…",
    provider: "slack",
    streamingLabel: "Reading Slack DM history",
    title: "Reading Slack DM history",
  },
  "tool-slackGetThreadReplies": {
    pendingLabel: "Reading Slack thread…",
    provider: "slack",
    streamingLabel: "Reading Slack thread",
    title: "Reading Slack thread",
  },
  "tool-slackListChannels": {
    pendingLabel: "Listing Slack channels…",
    provider: "slack",
    streamingLabel: "Listing Slack channels",
    title: "Listing Slack channels",
  },
  "tool-slackListUsers": {
    pendingLabel: "Listing Slack users…",
    provider: "slack",
    streamingLabel: "Listing Slack users",
    title: "Listing Slack users",
  },
  "tool-slackPostDirectMessage": {
    pendingLabel: "Sending Slack direct message…",
    provider: "slack",
    streamingLabel: "Sending Slack direct message",
    title: "Sending Slack direct message",
  },
  "tool-slackPostMessage": {
    pendingLabel: "Posting Slack message…",
    provider: "slack",
    streamingLabel: "Posting Slack message",
    title: "Posting Slack message",
  },
  "tool-slackSearchMessages": {
    pendingLabel: "Searching Slack…",
    provider: "slack",
    streamingLabel: "Searching Slack",
    title: "Searching Slack",
  },
  "tool-slackUpdateMessage": {
    pendingLabel: "Updating Slack message…",
    provider: "slack",
    streamingLabel: "Updating Slack message",
    title: "Updating Slack message",
  },
};

export function isConnectorActionToolType(
  type: string
): type is ConnectorActionToolType {
  return CONNECTION_ACTION_TOOL_TYPES.has(type);
}

export function getConnectionActionToolMeta(toolType: ConnectorActionToolType) {
  return CONNECTION_ACTION_TOOL_META[toolType];
}

function resolveConnectorToolChipFromOutput(args: {
  toolType: ConnectorActionToolType;
  input?: unknown;
  output?: ConnectionActionToolOutput;
}): string | undefined {
  if (!args.output) {
    return undefined;
  }

  if (args.toolType === "tool-driveUpdateFile") {
    const name = getOutputStringField(args.output, "name");
    const newName = getOutputStringField(args.output, "newName");
    if (name && newName && name !== newName) {
      return `${name} → ${newName}`;
    }
    if (newName) {
      return newName;
    }
    if (name) {
      return name;
    }
  }

  const resultItems = getConnectionActionResultItems(
    args.toolType,
    args.output
  );
  if (resultItems.length === 1) {
    return resultItems[0]?.label;
  }
  if (resultItems.length > 1) {
    return `${resultItems.length} results`;
  }

  const label = getConnectionActionResultLabel(
    args.toolType,
    args.output,
    args.input
  );
  return label === "Untitled" ? undefined : label;
}

/** Craft-style header: verb + mono chip (e.g. Creating `sample.txt`). */
export function getConnectorToolCallHeader(args: {
  toolType: ConnectorActionToolType;
  input?: unknown;
  output?: ConnectionActionToolOutput;
  isPending: boolean;
  denied?: boolean;
  interrupted?: boolean;
  slackUserLookup?: SlackUserLookup;
}) {
  const meta = getConnectionActionToolMeta(args.toolType);
  const chips = getConnectionActionContextChips(args.toolType, args.input);
  let chip: string | undefined = chips[0];

  if (
    (args.toolType === "tool-slackPostDirectMessage" ||
      args.toolType === "tool-slackGetDirectMessageHistory") &&
    !chip
  ) {
    chip = resolveSlackRecipientLabel(
      getInputStringField(args.input, "user") ??
        getInputStringField(args.input, "userName"),
      args.slackUserLookup
    );
  }

  if (
    (args.toolType === "tool-slackPostDirectMessage" ||
      args.toolType === "tool-slackGetDirectMessageHistory") &&
    args.output &&
    typeof args.output === "object"
  ) {
    const userName = getOutputStringField(args.output, "userName");
    if (userName) {
      chip = userName.startsWith("@") ? userName : userName;
    }
  }

  if (args.toolType === "tool-slackListUsers" && !chip && args.output) {
    const users = getOutputArrayField(args.output, "users");
    if (users.length === 1) {
      const user = users[0];
      if (user && typeof user === "object") {
        const resolvedLabel = slackUserDisplayLabel(
          user as Record<string, unknown>
        );
        if (resolvedLabel) {
          chip = resolvedLabel;
        }
      }
    } else if (users.length > 1) {
      chip = `${users.length} users`;
    }
  }

  if (args.toolType === "tool-driveMoveFile") {
    const outputName = args.output
      ? getOutputStringField(args.output, "name")
      : undefined;
    const outputDestination = args.output
      ? getOutputStringField(args.output, "toFolderName")
      : undefined;
    if (outputName && outputDestination) {
      chip = `${outputName} → ${outputDestination}`;
    } else if (outputName) {
      chip = outputName;
    }
  }

  if (args.toolType === "tool-driveListFolders" && !chip && args.output) {
    const folders = getOutputArrayField(args.output, "folders");
    if (folders.length === 1) {
      const folder = folders[0];
      if (folder && typeof folder === "object") {
        const name = getOutputStringField(folder, "name");
        if (name) {
          chip = name;
        }
      }
    } else if (folders.length > 1) {
      chip = `${folders.length} folders`;
    }
  }

  if (args.toolType === "tool-driveSearchFiles" && !chip && args.output) {
    const items = getOutputArrayField(args.output, "items");
    if (items.length === 1) {
      const item = items[0];
      if (item && typeof item === "object") {
        const name = getOutputStringField(item, "name");
        if (name) {
          chip = name;
        }
      }
    } else if (items.length > 1) {
      chip = `${items.length} items`;
    }
  }

  if (args.toolType === "tool-driveGetFile" && !chip && args.output) {
    const name = getOutputStringField(args.output, "name");
    if (name) {
      chip = name;
    }
  }

  if (!chip && args.output) {
    const fromOutput = resolveConnectorToolChipFromOutput({
      input: args.input,
      output: args.output,
      toolType: args.toolType,
    });
    if (fromOutput) {
      chip = fromOutput;
    }
  }

  const verb = args.interrupted
    ? "Stopped"
    : args.denied
      ? connectorToolHeaderVerb(args.toolType, meta.title, "denied")
      : args.isPending
        ? connectorToolHeaderVerb(args.toolType, meta.title, "pending")
        : connectorToolHeaderVerb(args.toolType, meta.title, "complete");

  return { chip, verb };
}

export function sanitizeConnectorToolInputForDisplay(
  input: unknown,
  options?: {
    toolType?: ConnectorActionToolType;
    slackUserLookup?: SlackUserLookup;
  }
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  let record = { ...(input as Record<string, unknown>) };
  for (const key of ["content", "body", "htmlBody", "textBody"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 240) {
      record[key] = `${value.slice(0, 240)}… (${value.length} chars)`;
    }
  }

  if (
    options?.toolType &&
    (options.toolType === "tool-slackPostDirectMessage" ||
      options.toolType === "tool-slackGetDirectMessageHistory")
  ) {
    for (const key of ["user", "userId"] as const) {
      const value = record[key];
      if (typeof value === "string" && isSlackUserId(value)) {
        const resolved = resolveSlackRecipientLabel(
          value,
          options.slackUserLookup
        );
        if (resolved) {
          record.user = resolved;
        } else if (key === "user") {
          record = Object.fromEntries(
            Object.entries(record).filter(([recordKey]) => recordKey !== "user")
          );
        }
        record = Object.fromEntries(
          Object.entries(record).filter(([recordKey]) => recordKey !== "userId")
        );
      }
    }
  }

  return record;
}

function sanitizeSlackConnectorOutputRecord(
  toolType: ConnectorActionToolType,
  record: Record<string, unknown>
) {
  if (
    toolType === "tool-slackPostDirectMessage" ||
    toolType === "tool-slackGetDirectMessageHistory" ||
    toolType === "tool-slackPostMessage" ||
    toolType === "tool-slackUpdateMessage"
  ) {
    for (const key of ["userId", "channelId", "ts"] as const) {
      delete record[key];
    }
  }

  if (toolType === "tool-slackListUsers" && Array.isArray(record.users)) {
    record.users = record.users.map((rawUser) => {
      if (!rawUser || typeof rawUser !== "object") {
        return rawUser;
      }
      const user = Object.fromEntries(
        Object.entries(rawUser).filter(([key]) => key !== "id")
      );
      return user;
    });
  }

  if (toolType === "tool-slackListChannels" && Array.isArray(record.channels)) {
    record.channels = record.channels.map((rawChannel) => {
      if (!rawChannel || typeof rawChannel !== "object") {
        return rawChannel;
      }
      const channel = Object.fromEntries(
        Object.entries(rawChannel).filter(([key]) => key !== "id")
      );
      return channel;
    });
  }
}

export function sanitizeConnectorToolOutputForDisplay(
  output: unknown,
  options?: {
    toolType?: ConnectorActionToolType;
  }
) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return output;
  }

  const record = { ...(output as Record<string, unknown>) };
  for (const key of ["content", "body", "htmlBody", "textBody"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.length > 240) {
      record[key] = `${value.slice(0, 240)}… (${value.length} chars)`;
    }
  }

  if (options?.toolType) {
    sanitizeSlackConnectorOutputRecord(options.toolType, record);
  }

  if (Array.isArray(record.messages) && record.messages.length > 5) {
    const remaining = record.messages.length - 5;
    record.messages = [...record.messages.slice(0, 5), `… ${remaining} more`];
  }

  return record;
}

export function connectorToolCallHasExpandableBody(args: {
  output?: ConnectionActionToolOutput;
  isPending: boolean;
  denied?: boolean;
  input?: unknown;
  toolType?: ConnectorActionToolType;
}) {
  if (args.isPending) {
    return false;
  }
  if (args.denied && args.input !== undefined) {
    return true;
  }
  if (args.output?.error) {
    return true;
  }

  const sanitized = sanitizeConnectorToolOutputForDisplay(args.output, {
    toolType: args.toolType,
  });
  return (
    sanitized !== null &&
    typeof sanitized === "object" &&
    !Array.isArray(sanitized) &&
    Object.keys(sanitized).length > 0
  );
}

/** Timeline step title for the action outcome row (not the in-progress action). */
export function getConnectionActionOutcomeLabel(
  toolType: ConnectorActionToolType
): string {
  const { title } = getConnectionActionToolMeta(toolType);

  if (/^(Listing|Searching|Reading)\b/.test(title)) {
    if (title.startsWith("Listing")) {
      return "Listed";
    }
    if (title.startsWith("Searching")) {
      return "Searched";
    }
    return "Read";
  }
  if (title.startsWith("Creating")) {
    return "Created";
  }
  if (title.startsWith("Renaming")) {
    return "Renamed";
  }
  if (title.startsWith("Updating")) {
    return "Updated";
  }
  if (title.startsWith("Uploading")) {
    return "Uploaded";
  }
  if (title.startsWith("Moving")) {
    return "Moved";
  }
  if (title.startsWith("Sending")) {
    return "Sent";
  }
  if (title.startsWith("Replying")) {
    return "Replied";
  }
  if (title.startsWith("Deleting")) {
    return "Deleted";
  }
  if (title.startsWith("Appending")) {
    return "Appended";
  }
  if (title.startsWith("Posting")) {
    return "Posted";
  }
  if (title.startsWith("Transitioning")) {
    return "Transitioned";
  }
  if (title.startsWith("Adding")) {
    return "Added";
  }

  return "Results";
}

export function isConnectionActionToolPending(part: {
  type: string;
  state?: string;
}) {
  if (!isConnectorActionToolType(part.type)) {
    return false;
  }
  if (!part.state) {
    return true;
  }
  return (
    part.state === "input-streaming" ||
    part.state === "input-available" ||
    part.state === "approval-requested"
  );
}

export function isConnectorToolExecutionDenied(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return false;
  }
  return (output as Record<string, unknown>).type === "execution-denied";
}

export function getConnectorToolDeniedReason(output: unknown) {
  if (!isConnectorToolExecutionDenied(output)) {
    return;
  }
  const reason = (output as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.trim()
    ? reason.trim()
    : "Rejected by user";
}

export function getFirstPendingConnectionActionStreamingLabel(
  parts: Array<{ type: string; state?: string }>
) {
  for (const part of parts) {
    if (!isConnectionActionToolPending(part)) {
      continue;
    }
    if (!isConnectorActionToolType(part.type)) {
      continue;
    }
    return getConnectionActionToolMeta(part.type).streamingLabel;
  }
}

export type ConnectionActionToolOutput = {
  error?: string;
  code?: string;
  title?: string;
  name?: string;
  userName?: string;
  channelName?: string;
  summary?: string;
  link?: string;
  connectUrl?: string;
  connectLabel?: string;
  messages?: unknown;
};

export type ConnectionActionResultItem = {
  key: string;
  label: string;
  link?: string;
};

function getInputStringField(input: unknown, key: string) {
  if (!input || typeof input !== "object") {
    return;
  }
  const value = (input as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function truncateActionTargetId(value: string, maxLength = 28) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

function isSlackUserId(value: string) {
  return /^U[A-Z0-9]{8,}$/i.test(value.trim());
}

function formatSlackRecipientChip(value: string) {
  const trimmed = value.trim();
  if (!trimmed || isSlackUserId(trimmed)) {
    return;
  }
  if (trimmed.startsWith("@")) {
    return trimmed;
  }
  return trimmed;
}

function slackUserDisplayLabel(user: Record<string, unknown>) {
  const displayName = getOutputStringField(user, "displayName");
  const realName = getOutputStringField(user, "realName");
  const username = getOutputStringField(user, "username");
  return (
    displayName ??
    realName ??
    (username ? `@${username}` : undefined) ??
    undefined
  );
}

export function buildSlackUserLookupFromParts(
  parts: ChatMessagePart[]
): SlackUserLookup {
  const lookup: SlackUserLookup = new Map();

  for (const part of parts) {
    if (
      part.type !== "tool-slackListUsers" ||
      !("output" in part) ||
      !part.output
    ) {
      continue;
    }

    const users = getOutputArrayField(part.output, "users");
    for (const rawUser of users) {
      if (!rawUser || typeof rawUser !== "object") {
        continue;
      }
      const user = rawUser as Record<string, unknown>;
      const id = getOutputStringField(user, "id");
      const label = slackUserDisplayLabel(user);
      if (id && label) {
        lookup.set(id, label);
        lookup.set(id.toUpperCase(), label);
      }
    }
  }

  return lookup;
}

export function resolveSlackRecipientLabel(
  value: string | undefined,
  lookup?: SlackUserLookup
) {
  if (!value?.trim()) {
    return;
  }
  const trimmed = value.trim();
  if (isSlackUserId(trimmed)) {
    return lookup?.get(trimmed) ?? lookup?.get(trimmed.toUpperCase());
  }
  return formatSlackRecipientChip(trimmed);
}

function connectorToolTitleForPhase(
  title: string,
  phase: "denied" | "complete"
) {
  const replacements: [string, string, string][] = [
    ["Sending ", "Send ", "Sent "],
    ["Creating ", "Create ", "Created "],
    ["Reading ", "Read ", "Read "],
    ["Listing ", "List ", "Listed "],
    ["Searching ", "Search ", "Searched "],
    ["Posting ", "Post ", "Posted "],
    ["Updating ", "Update ", "Updated "],
    ["Uploading ", "Upload ", "Uploaded "],
    ["Moving ", "Move ", "Moved "],
    ["Renaming ", "Rename ", "Renamed "],
    ["Deleting ", "Delete ", "Deleted "],
    ["Replying ", "Reply ", "Replied "],
    ["Appending ", "Append ", "Appended "],
    ["Transitioning ", "Transition ", "Transitioned "],
    ["Adding ", "Add ", "Added "],
  ];

  for (const [prefix, denied, complete] of replacements) {
    if (title.startsWith(prefix)) {
      return title.replace(prefix, phase === "denied" ? denied : complete);
    }
  }

  if (phase === "complete") {
    return title;
  }

  return connectorToolProgressVerb(title, phase);
}

function connectorToolHeaderVerb(
  toolType: ConnectorActionToolType,
  title: string,
  phase: "pending" | "denied" | "complete"
) {
  const driveLabel = connectorDriveActionLabel(toolType, phase);
  if (driveLabel) {
    return driveLabel;
  }

  if (phase === "pending") {
    return title;
  }

  return connectorToolTitleForPhase(title, phase);
}

function connectorDriveActionLabel(
  toolType: ConnectorActionToolType,
  phase: "pending" | "denied" | "complete"
): string | undefined {
  if (toolType === "tool-driveCreateFolder") {
    if (phase === "complete") {
      return "Created folder";
    }
    return phase === "pending" ? "Creating folder" : "Create folder";
  }
  if (toolType === "tool-driveCreateSharedDrive") {
    if (phase === "complete") {
      return "Created shared drive";
    }
    return phase === "pending"
      ? "Creating shared drive"
      : "Create shared drive";
  }
  return undefined;
}

function connectorToolProgressVerb(title: string, phase: "pending" | "denied") {
  const first = title.split(" ")[0] ?? title;
  if (phase === "pending") {
    return first;
  }

  const imperative: Record<string, string> = {
    Adding: "Add",
    Appending: "Append",
    Creating: "Create",
    Deleting: "Delete",
    Listing: "List",
    Moving: "Move",
    Posting: "Post",
    Reading: "Read",
    Renaming: "Rename",
    Replying: "Reply",
    Searching: "Search",
    Sending: "Send",
    Transitioning: "Transition",
    Updating: "Update",
    Uploading: "Upload",
  };
  return imperative[first] ?? first;
}

function uniqueChips(chips: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const chip of chips) {
    if (seen.has(chip)) {
      continue;
    }
    seen.add(chip);
    unique.push(chip);
  }
  return unique;
}

export function getConnectionActionContextChips(
  toolType: ConnectorActionToolType,
  input: unknown
) {
  const chips: string[] = [];
  const title = getInputStringField(input, "title");
  const rowTitle = getInputStringField(input, "rowTitle");
  const isNotionDbRowTool =
    toolType === "tool-notionDbUpdateRow" ||
    toolType === "tool-notionDbRenameRow" ||
    toolType === "tool-notionDbMoveRow";

  if (isNotionDbRowTool && rowTitle) {
    chips.push(rowTitle);
    if (title && title !== rowTitle) {
      chips.push(`→ ${title}`);
    }
  } else if (title) {
    chips.push(title);
  }

  const name = getInputStringField(input, "name");
  if (
    name &&
    (toolType === "tool-driveCreateFolder" ||
      toolType === "tool-driveCreateSharedDrive" ||
      toolType === "tool-driveUploadFile")
  ) {
    chips.push(name);
  }

  const fileName = getInputStringField(input, "fileName");
  if (toolType === "tool-driveMoveFile") {
    const toFolderName = getInputStringField(input, "toFolderName");
    if (fileName && toFolderName) {
      chips.push(`${fileName} → ${toFolderName}`);
      return uniqueChips(chips);
    }
    if (fileName) {
      chips.push(fileName);
    }
    if (toFolderName) {
      chips.push(`→ ${toFolderName}`);
    }
    if (chips.length > 0) {
      return uniqueChips(chips);
    }
    return [];
  }

  if (toolType === "tool-driveUpdateFile") {
    const newName = getInputStringField(input, "name");
    if (fileName) {
      chips.push(fileName);
    }
    if (newName && newName !== fileName) {
      chips.push(`→ ${newName}`);
    }
    if (chips.length > 0) {
      return uniqueChips(chips);
    }
    return [];
  }

  if (fileName) {
    chips.push(fileName);
  }

  const driveSearchQuery = getInputStringField(input, "query");
  if (driveSearchQuery && toolType === "tool-driveSearchFiles") {
    chips.push(driveSearchQuery);
  }

  const driveParentId = getInputStringField(input, "parentId");
  if (driveParentId && toolType === "tool-driveListFolders") {
    chips.push(`in ${truncateActionTargetId(driveParentId)}`);
  }

  const driveFileId = getInputStringField(input, "fileId");
  if (driveFileId && toolType === "tool-driveGetFile") {
    return [];
  }

  const pageTitle = getInputStringField(input, "pageTitle");
  if (
    pageTitle &&
    (toolType === "tool-notionRenamePage" ||
      toolType === "tool-notionUpdatePage" ||
      toolType === "tool-notionMovePage" ||
      toolType === "tool-confluenceRenamePage" ||
      toolType === "tool-confluenceUpdatePage" ||
      toolType === "tool-confluenceMovePage" ||
      toolType === "tool-sharePointRenamePage" ||
      toolType === "tool-sharePointUpdatePage")
  ) {
    chips.push(pageTitle);
  }

  const siteName = getInputStringField(input, "siteName");
  if (
    siteName &&
    (toolType === "tool-sharePointCreatePage" ||
      toolType === "tool-sharePointRenamePage" ||
      toolType === "tool-sharePointUpdatePage")
  ) {
    chips.push(siteName);
  }

  const parentPageTitle = getInputStringField(input, "parentPageTitle");
  if (
    parentPageTitle &&
    (toolType === "tool-notionCreatePage" ||
      toolType === "tool-notionCreateDatabase" ||
      toolType === "tool-notionMovePage" ||
      toolType === "tool-confluenceCreatePage" ||
      toolType === "tool-confluenceMovePage")
  ) {
    chips.push(
      toolType === "tool-notionMovePage" ||
        toolType === "tool-confluenceMovePage"
        ? `→ ${parentPageTitle}`
        : parentPageTitle
    );
  }

  const databaseTitle = getInputStringField(input, "databaseTitle");
  if (databaseTitle) {
    chips.push(databaseTitle);
  }

  if (rowTitle && !isNotionDbRowTool) {
    chips.push(rowTitle);
  }

  const toDatabaseTitle = getInputStringField(input, "toDatabaseTitle");
  if (toDatabaseTitle && toolType === "tool-notionDbMoveRow") {
    chips.push(`→ ${toDatabaseTitle}`);
  }

  const toParentPageTitle = getInputStringField(input, "toParentPageTitle");
  if (toParentPageTitle && toolType === "tool-notionDbMoveRow") {
    chips.push(`→ ${toParentPageTitle}`);
  }

  const spaceKey = getInputStringField(input, "spaceKey");
  if (
    spaceKey &&
    (toolType === "tool-confluenceCreateSpace" ||
      toolType === "tool-confluenceCreatePage" ||
      toolType === "tool-confluenceRenamePage" ||
      toolType === "tool-confluenceUpdatePage" ||
      toolType === "tool-confluenceMovePage")
  ) {
    chips.push(`Space ${spaceKey}`);
  }

  const channelName = getInputStringField(input, "channelName");
  if (
    channelName &&
    (toolType === "tool-slackPostMessage" ||
      toolType === "tool-slackSearchMessages" ||
      toolType === "tool-slackGetConversationHistory" ||
      toolType === "tool-slackGetThreadReplies" ||
      toolType === "tool-slackUpdateMessage")
  ) {
    chips.push(channelName.startsWith("#") ? channelName : `#${channelName}`);
  }

  const threadTs = getInputStringField(input, "threadTs");
  if (threadTs && toolType === "tool-slackGetThreadReplies") {
    chips.push(`thread ${threadTs}`);
  }

  const dmUserName = getInputStringField(input, "user");
  const legacyDmUserName = getInputStringField(input, "userName");
  const dmUserEmail = getInputStringField(input, "userEmail");
  if (
    toolType === "tool-slackPostDirectMessage" ||
    toolType === "tool-slackGetDirectMessageHistory"
  ) {
    const recipient =
      formatSlackRecipientChip(dmUserName ?? "") ??
      formatSlackRecipientChip(legacyDmUserName ?? "") ??
      (dmUserEmail ? formatSlackRecipientChip(dmUserEmail) : undefined);
    if (recipient) {
      chips.push(recipient);
    }
  }

  const query = getInputStringField(input, "query");
  if (
    query &&
    (toolType === "tool-slackSearchMessages" ||
      toolType === "tool-gmailSearchMessages")
  ) {
    chips.push(query);
  }

  const gmailLabelId = getInputStringField(input, "labelId");
  if (gmailLabelId && toolType === "tool-gmailListMessages") {
    chips.push(gmailLabelId);
  }

  const gmailMessageId = getInputStringField(input, "messageId");
  if (
    gmailMessageId &&
    (toolType === "tool-gmailGetMessage" ||
      toolType === "tool-gmailReplyToMessage")
  ) {
    chips.push(gmailMessageId);
  }

  const gmailThreadId = getInputStringField(input, "threadId");
  if (gmailThreadId && toolType === "tool-gmailGetThread") {
    chips.push(gmailThreadId);
  }

  const gmailTo = getInputStringField(input, "to");
  const gmailSubject = getInputStringField(input, "subject");
  if (
    toolType === "tool-gmailSendMessage" ||
    toolType === "tool-gmailCreateDraft"
  ) {
    if (gmailTo) {
      chips.push(gmailTo);
    }
    if (gmailSubject) {
      chips.push(gmailSubject);
    }
  }

  const gmailDraftId = getInputStringField(input, "draftId");
  if (gmailDraftId && toolType === "tool-gmailSendDraft") {
    chips.push(gmailDraftId);
  }

  const calendarQuery = getInputStringField(input, "query");
  if (calendarQuery && toolType === "tool-googleCalendarListEvents") {
    chips.push(calendarQuery);
  }

  const calendarId = getInputStringField(input, "calendarId");
  if (
    calendarId &&
    (toolType === "tool-googleCalendarListEvents" ||
      toolType === "tool-googleCalendarGetEvent" ||
      toolType === "tool-googleCalendarCreateEvent" ||
      toolType === "tool-googleCalendarUpdateEvent" ||
      toolType === "tool-googleCalendarDeleteEvent")
  ) {
    chips.push(calendarId);
  }

  const eventId = getInputStringField(input, "eventId");
  if (
    eventId &&
    (toolType === "tool-googleCalendarGetEvent" ||
      toolType === "tool-googleCalendarUpdateEvent" ||
      toolType === "tool-googleCalendarDeleteEvent")
  ) {
    chips.push(eventId);
  }

  const eventSummary = getInputStringField(input, "summary");
  if (
    eventSummary &&
    (toolType === "tool-googleCalendarCreateEvent" ||
      toolType === "tool-googleCalendarUpdateEvent")
  ) {
    chips.push(eventSummary);
  }

  const slackChannelName = getInputStringField(input, "name");
  if (slackChannelName && toolType === "tool-slackCreateChannel") {
    chips.push(
      slackChannelName.startsWith("#")
        ? slackChannelName
        : `#${slackChannelName}`
    );
  }

  const issueIdOrKey = getInputStringField(input, "issueIdOrKey");
  if (
    issueIdOrKey &&
    (toolType === "tool-jiraGetIssue" ||
      toolType === "tool-jiraUpdateIssue" ||
      toolType === "tool-jiraListTransitions" ||
      toolType === "tool-jiraTransitionIssue" ||
      toolType === "tool-jiraAddComment")
  ) {
    chips.push(issueIdOrKey);
  }

  const projectKey = getInputStringField(input, "projectKey");
  if (projectKey && toolType === "tool-jiraCreateIssue") {
    chips.push(projectKey);
  }

  const jql = getInputStringField(input, "jql");
  if (jql && toolType === "tool-jiraSearchIssues") {
    chips.push(truncateActionTargetId(jql));
  }

  const confluenceSpaceName = getInputStringField(input, "name");
  if (confluenceSpaceName && toolType === "tool-confluenceCreateSpace") {
    chips.push(confluenceSpaceName);
  }

  if (chips.length > 0) {
    return uniqueChips(chips);
  }

  const pageId = getInputStringField(input, "pageId");
  const rowId = getInputStringField(input, "rowId");
  const documentId = getInputStringField(input, "documentId");
  const fileId = getInputStringField(input, "fileId");
  const target = pageId ?? rowId ?? documentId ?? fileId;
  if (target) {
    chips.push(truncateActionTargetId(target));
  }

  return chips;
}

function getOutputStringField(output: unknown, key: string) {
  if (!output || typeof output !== "object") {
    return;
  }
  const value = (output as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOutputArrayField(output: unknown, key: string) {
  if (!output || typeof output !== "object") {
    return [];
  }
  const value = (output as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function truncateActivityLabel(value: string, maxLength = 40) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

function formatSlackChannelLabel(name: string) {
  return name.startsWith("#") ? name : `#${name}`;
}

function extractDriveListResultItems(
  output: unknown,
  collectionKey: "folders" | "items"
): ConnectionActionResultItem[] {
  const entries = getOutputArrayField(output, collectionKey);
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }

    const entry = rawEntry as Record<string, unknown>;
    const id = getOutputStringField(entry, "id");
    const name = getOutputStringField(entry, "name");
    if (!id && !name) {
      continue;
    }

    const label = name ? truncateActivityLabel(name) : "(item)";
    const link = getOutputStringField(entry, "link");
    const key = id ?? link ?? label;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    items.push({
      key,
      label,
      ...(link ? { link } : {}),
    });
  }

  return items;
}

function extractGmailMessageResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const messages = (output as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) {
    return [];
  }

  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawMessage of messages) {
    if (!rawMessage || typeof rawMessage !== "object") {
      continue;
    }

    const message = rawMessage as Record<string, unknown>;
    const subject = getOutputStringField(message, "subject");
    const label = subject ?? "(no subject)";
    const link = getOutputStringField(message, "link");
    const id = getOutputStringField(message, "id");
    const threadId = getOutputStringField(message, "threadId");
    const key = id ?? link ?? threadId ?? label;

    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    items.push({
      key,
      label,
      link,
    });
  }

  return items;
}

function extractSlackChannelResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  const channels = getOutputArrayField(output, "channels");
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawChannel of channels) {
    if (!rawChannel || typeof rawChannel !== "object") {
      continue;
    }

    const channel = rawChannel as Record<string, unknown>;
    const id = getOutputStringField(channel, "id");
    const name = getOutputStringField(channel, "name");
    if (!id && !name) {
      continue;
    }

    const label = name ? formatSlackChannelLabel(name) : "(channel)";
    const key = id ?? name ?? label;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    items.push({ key, label });
  }

  return items;
}

function extractSlackUserResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  const users = getOutputArrayField(output, "users");
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawUser of users) {
    if (!rawUser || typeof rawUser !== "object") {
      continue;
    }

    const user = rawUser as Record<string, unknown>;
    const id = getOutputStringField(user, "id");
    const displayName = getOutputStringField(user, "displayName");
    const realName = getOutputStringField(user, "realName");
    const username = getOutputStringField(user, "username");
    const label =
      displayName ??
      realName ??
      (username ? `@${username}` : undefined) ??
      "(user)";

    const key = id ?? username ?? label;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    items.push({ key, label });
  }

  return items;
}

function extractSlackMessageResultItems(
  toolType: ConnectorActionToolType,
  output: unknown
): ConnectionActionResultItem[] {
  const messages = getOutputArrayField(output, "messages");
  const includeChannelPrefix = toolType === "tool-slackSearchMessages";
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawMessage of messages) {
    if (!rawMessage || typeof rawMessage !== "object") {
      continue;
    }

    const message = rawMessage as Record<string, unknown>;
    const text = getOutputStringField(message, "text");
    const userName = getOutputStringField(message, "userName");
    const channelName = getOutputStringField(message, "channelName");
    const permalink = getOutputStringField(message, "permalink");
    const ts = getOutputStringField(message, "ts");

    let label = text ? truncateActivityLabel(text) : undefined;
    if (!label && userName) {
      label = userName;
    }
    if (!label) {
      label = "(message)";
    }

    if (includeChannelPrefix && channelName) {
      label = `${formatSlackChannelLabel(channelName)}: ${label}`;
      label = truncateActivityLabel(label, 48);
    }

    const key = ts ?? permalink ?? label;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    items.push({
      key,
      label,
      link: permalink,
    });
  }

  return items;
}

function extractSlackSingleResultItem(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const text = getOutputStringField(output, "text");
  const channelName =
    getOutputStringField(output, "channelName") ??
    getOutputStringField(output, "name");
  const userName = getOutputStringField(output, "userName");
  const link = getOutputStringField(output, "link");
  const ts = getOutputStringField(output, "ts");
  const channelId = getOutputStringField(output, "channelId");

  let label: string | undefined;
  if (text) {
    label = truncateActivityLabel(text);
  } else if (channelName) {
    label = formatSlackChannelLabel(channelName);
  } else if (userName) {
    label = userName;
  }

  if (!label && !link) {
    return [];
  }

  const resolvedLabel = label ?? "Message sent";
  const key = ts ?? channelId ?? link ?? resolvedLabel;

  return [
    {
      key,
      label: resolvedLabel,
      ...(link ? { link } : {}),
    },
  ];
}

function formatJiraIssueLabel(
  key: string | undefined,
  summary: string | undefined
) {
  const trimmedSummary = summary ? truncateActivityLabel(summary) : undefined;
  if (key && trimmedSummary) {
    return `${key}: ${trimmedSummary}`;
  }
  return key ?? trimmedSummary ?? "(issue)";
}

function formatJiraProjectLabel(
  key: string | undefined,
  name: string | undefined
) {
  const trimmedName = name ? truncateActivityLabel(name) : undefined;
  if (key && trimmedName && trimmedName !== key) {
    return `${key}: ${trimmedName}`;
  }
  return key ?? trimmedName ?? "(project)";
}

function extractJiraProjectResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  const knowledgeBases = getOutputArrayField(output, "knowledgeBases");
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawProject of knowledgeBases) {
    if (!rawProject || typeof rawProject !== "object") {
      continue;
    }

    const project = rawProject as Record<string, unknown>;
    const id = getOutputStringField(project, "id");
    const key = getOutputStringField(project, "key");
    const name = getOutputStringField(project, "name");
    if (!id && !key && !name) {
      continue;
    }

    const label = formatJiraProjectLabel(key, name);
    const itemKey = id ?? key ?? name ?? label;
    if (seenKeys.has(itemKey)) {
      continue;
    }
    seenKeys.add(itemKey);

    items.push({ key: itemKey, label });
  }

  return items;
}

function extractJiraIssueResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  const issues = getOutputArrayField(output, "issues");
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawIssue of issues) {
    if (!rawIssue || typeof rawIssue !== "object") {
      continue;
    }

    const issue = rawIssue as Record<string, unknown>;
    const id = getOutputStringField(issue, "id");
    const key = getOutputStringField(issue, "key");
    const summary = getOutputStringField(issue, "summary");
    const link = getOutputStringField(issue, "url");
    if (!id && !key && !summary) {
      continue;
    }

    const label = formatJiraIssueLabel(key, summary);
    const itemKey = id ?? key ?? link ?? label;
    if (seenKeys.has(itemKey)) {
      continue;
    }
    seenKeys.add(itemKey);

    items.push({
      key: itemKey,
      label,
      ...(link ? { link } : {}),
    });
  }

  return items;
}

function extractJiraSingleResultItem(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const title = getOutputStringField(output, "title");
  const summary = getOutputStringField(output, "summary");
  const key =
    getOutputStringField(output, "key") ??
    getOutputStringField(output, "issueIdOrKey");
  const link = getOutputStringField(output, "url");
  const id = getOutputStringField(output, "id");

  let label: string | undefined;
  if (title?.includes(":")) {
    label = truncateActivityLabel(title);
  } else if (summary) {
    label = truncateActivityLabel(summary);
  } else if (key) {
    label = formatJiraIssueLabel(key, undefined);
  }

  if (!label && !link) {
    return [];
  }

  const resolvedLabel = label ?? key ?? "Issue updated";
  const itemKey = id ?? key ?? link ?? resolvedLabel;

  return [
    {
      key: itemKey,
      label: resolvedLabel,
      ...(link ? { link } : {}),
    },
  ];
}

function extractJiraTransitionResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  const transitions = getOutputArrayField(output, "transitions");
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawTransition of transitions) {
    if (!rawTransition || typeof rawTransition !== "object") {
      continue;
    }

    const transition = rawTransition as Record<string, unknown>;
    const id = getOutputStringField(transition, "id");
    const name = getOutputStringField(transition, "name");
    const toStatus = getOutputStringField(transition, "toStatus");
    if (!id && !name) {
      continue;
    }

    const label = toStatus ? `${name} → ${toStatus}` : (name ?? "(transition)");
    const itemKey = id ?? name ?? label;
    if (seenKeys.has(itemKey)) {
      continue;
    }
    seenKeys.add(itemKey);

    items.push({ key: itemKey, label });
  }

  return items;
}

function formatCalendarEventLabel(summary: string | undefined) {
  return summary ? truncateActivityLabel(summary) : "(event)";
}

function extractCalendarCalendarResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  const calendars = getOutputArrayField(output, "calendars");
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawCalendar of calendars) {
    if (!rawCalendar || typeof rawCalendar !== "object") {
      continue;
    }

    const calendar = rawCalendar as Record<string, unknown>;
    const id = getOutputStringField(calendar, "id");
    const summary = getOutputStringField(calendar, "summary");
    if (!id && !summary) {
      continue;
    }

    const baseLabel = summary ? truncateActivityLabel(summary) : "(calendar)";
    const label =
      calendar.primary === true ? `${baseLabel} (primary)` : baseLabel;
    const itemKey = id ?? summary ?? label;
    if (seenKeys.has(itemKey)) {
      continue;
    }
    seenKeys.add(itemKey);

    items.push({ key: itemKey, label });
  }

  return items;
}

function extractCalendarEventResultItems(
  output: unknown
): ConnectionActionResultItem[] {
  const events = getOutputArrayField(output, "events");
  const items: ConnectionActionResultItem[] = [];
  const seenKeys = new Set<string>();

  for (const rawEvent of events) {
    if (!rawEvent || typeof rawEvent !== "object") {
      continue;
    }

    const event = rawEvent as Record<string, unknown>;
    const id = getOutputStringField(event, "id");
    const summary = getOutputStringField(event, "summary");
    const when = getOutputStringField(event, "when");
    const link = getOutputStringField(event, "link");
    if (!id && !summary && !when) {
      continue;
    }

    const label = formatCalendarEventLabel(summary);
    const itemKey = id ?? link ?? label;
    if (seenKeys.has(itemKey)) {
      continue;
    }
    seenKeys.add(itemKey);

    items.push({
      key: itemKey,
      label,
      ...(link ? { link } : {}),
    });
  }

  return items;
}

function extractCalendarSingleResultItem(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const summary = getOutputStringField(output, "summary");
  const when = getOutputStringField(output, "when");
  const link = getOutputStringField(output, "link");
  const id =
    getOutputStringField(output, "id") ??
    getOutputStringField(output, "eventId");

  const label = summary
    ? formatCalendarEventLabel(summary)
    : when
      ? truncateActivityLabel(when)
      : undefined;

  if (!label && !link) {
    return [];
  }

  const resolvedLabel = label ?? "Calendar event";
  const itemKey = id ?? link ?? resolvedLabel;

  return [
    {
      key: itemKey,
      label: resolvedLabel,
      ...(link ? { link } : {}),
    },
  ];
}

function extractGoogleWorkspaceSingleResultItem(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const title = getOutputStringField(output, "title");
  const name = getOutputStringField(output, "name");
  const summary = getOutputStringField(output, "summary");
  const link =
    getOutputStringField(output, "link") ??
    getOutputStringField(output, "webViewLink");
  const id =
    getOutputStringField(output, "id") ??
    getOutputStringField(output, "fileId") ??
    getOutputStringField(output, "documentId") ??
    getOutputStringField(output, "spreadsheetId");

  let label: string | undefined;
  if (title) {
    label = truncateActivityLabel(title);
  } else if (name) {
    label = truncateActivityLabel(name);
  } else if (summary) {
    label = truncateActivityLabel(summary);
  }

  if (!label && !link) {
    return [];
  }

  const resolvedLabel = label ?? "Updated";
  const itemKey = id ?? link ?? resolvedLabel;

  return [
    {
      key: itemKey,
      label: resolvedLabel,
      ...(link ? { link } : {}),
    },
  ];
}

function extractNotionSingleResultItem(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const title = getOutputStringField(output, "title");
  const link = getOutputStringField(output, "link");
  const id =
    getOutputStringField(output, "pageId") ??
    getOutputStringField(output, "rowId") ??
    getOutputStringField(output, "databaseId");

  if (!title && !link) {
    return [];
  }

  const resolvedLabel = title ? truncateActivityLabel(title) : "Notion page";
  const itemKey = id ?? link ?? resolvedLabel;

  return [
    {
      key: itemKey,
      label: resolvedLabel,
      ...(link ? { link } : {}),
    },
  ];
}

function extractAtlassianWikiSingleResultItem(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const title = getOutputStringField(output, "title");
  const name = getOutputStringField(output, "name");
  const link = getOutputStringField(output, "link");
  const id =
    getOutputStringField(output, "pageId") ??
    getOutputStringField(output, "spaceId") ??
    getOutputStringField(output, "spaceKey") ??
    getOutputStringField(output, "siteId");

  let label: string | undefined;
  if (title) {
    label = truncateActivityLabel(title);
  } else if (name) {
    label = truncateActivityLabel(name);
  }

  if (!label && !link) {
    return [];
  }

  const resolvedLabel = label ?? "Page";
  const itemKey = id ?? link ?? resolvedLabel;

  return [
    {
      key: itemKey,
      label: resolvedLabel,
      ...(link ? { link } : {}),
    },
  ];
}

const DRIVE_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-driveGetFile",
]);

const GMAIL_LIST_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-gmailListMessages",
  "tool-gmailSearchMessages",
]);

const SLACK_MESSAGE_LIST_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-slackSearchMessages",
  "tool-slackGetConversationHistory",
  "tool-slackGetDirectMessageHistory",
  "tool-slackGetThreadReplies",
]);

const SLACK_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-slackPostMessage",
  "tool-slackPostDirectMessage",
  "tool-slackUpdateMessage",
  "tool-slackCreateChannel",
]);

const JIRA_LIST_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-jiraListProjects",
  "tool-jiraSearchIssues",
  "tool-jiraListTransitions",
]);

const JIRA_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-jiraGetIssue",
  "tool-jiraCreateIssue",
  "tool-jiraUpdateIssue",
  "tool-jiraTransitionIssue",
  "tool-jiraAddComment",
]);

const CALENDAR_LIST_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-googleCalendarListCalendars",
  "tool-googleCalendarListEvents",
]);

const CALENDAR_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-googleCalendarGetEvent",
  "tool-googleCalendarCreateEvent",
  "tool-googleCalendarUpdateEvent",
  "tool-googleCalendarDeleteEvent",
]);

const GOOGLE_WORKSPACE_SINGLE_RESULT_TOOL_TYPES =
  new Set<ConnectorActionToolType>([
    "tool-driveCreateFolder",
    "tool-driveCreateSharedDrive",
    "tool-driveUploadFile",
    "tool-driveMoveFile",
    "tool-driveUpdateFile",
  ]);

const NOTION_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-notionCreatePage",
  "tool-notionCreateDatabase",
  "tool-notionRenamePage",
  "tool-notionUpdatePage",
  "tool-notionMovePage",
  "tool-notionDbCreateRow",
  "tool-notionDbRenameRow",
  "tool-notionDbUpdateRow",
  "tool-notionDbMoveRow",
]);

const CONFLUENCE_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-confluenceCreateSpace",
  "tool-confluenceCreatePage",
  "tool-confluenceRenamePage",
  "tool-confluenceUpdatePage",
  "tool-confluenceMovePage",
]);

const SHAREPOINT_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-sharePointCreatePage",
  "tool-sharePointRenamePage",
  "tool-sharePointUpdatePage",
]);

const GMAIL_SINGLE_RESULT_TOOL_TYPES = new Set<ConnectorActionToolType>([
  "tool-gmailCreateDraft",
  "tool-gmailSendMessage",
  "tool-gmailReplyToMessage",
  "tool-gmailGetMessage",
  "tool-gmailGetThread",
]);

function extractGmailSingleResultItem(
  output: unknown
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  const subject = getOutputStringField(output, "subject");
  const snippet = getOutputStringField(output, "snippet");
  const link = getOutputStringField(output, "link");
  const label = subject ?? snippet;

  if (!label && !link) {
    return [];
  }

  const id =
    getOutputStringField(output, "id") ??
    getOutputStringField(output, "messageId") ??
    getOutputStringField(output, "draftId") ??
    getOutputStringField(output, "threadId");
  const resolvedLabel = label ?? "Draft sent";

  return [
    {
      key: id ?? link ?? resolvedLabel,
      label: resolvedLabel,
      ...(link ? { link } : {}),
    },
  ];
}

export function getConnectionActionResultItems(
  toolType: ConnectorActionToolType,
  output?: ConnectionActionToolOutput | Record<string, unknown>
): ConnectionActionResultItem[] {
  if (!output || typeof output !== "object") {
    return [];
  }

  if (getOutputStringField(output, "error")) {
    return [];
  }

  if (GMAIL_LIST_RESULT_TOOL_TYPES.has(toolType)) {
    return extractGmailMessageResultItems(output);
  }

  if (toolType === "tool-driveListFolders") {
    return extractDriveListResultItems(output, "folders");
  }

  if (toolType === "tool-driveSearchFiles") {
    return extractDriveListResultItems(output, "items");
  }

  if (DRIVE_SINGLE_RESULT_TOOL_TYPES.has(toolType)) {
    return extractGoogleWorkspaceSingleResultItem(output);
  }

  if (toolType === "tool-slackListChannels") {
    return extractSlackChannelResultItems(output);
  }

  if (toolType === "tool-slackListUsers") {
    return extractSlackUserResultItems(output);
  }

  if (SLACK_MESSAGE_LIST_RESULT_TOOL_TYPES.has(toolType)) {
    return extractSlackMessageResultItems(toolType, output);
  }

  if (SLACK_SINGLE_RESULT_TOOL_TYPES.has(toolType)) {
    return extractSlackSingleResultItem(output);
  }

  if (JIRA_LIST_RESULT_TOOL_TYPES.has(toolType)) {
    if (toolType === "tool-jiraListProjects") {
      return extractJiraProjectResultItems(output);
    }

    if (toolType === "tool-jiraSearchIssues") {
      return extractJiraIssueResultItems(output);
    }

    return extractJiraTransitionResultItems(output);
  }

  if (JIRA_SINGLE_RESULT_TOOL_TYPES.has(toolType)) {
    return extractJiraSingleResultItem(output);
  }

  if (CALENDAR_LIST_RESULT_TOOL_TYPES.has(toolType)) {
    if (toolType === "tool-googleCalendarListCalendars") {
      return extractCalendarCalendarResultItems(output);
    }

    return extractCalendarEventResultItems(output);
  }

  if (CALENDAR_SINGLE_RESULT_TOOL_TYPES.has(toolType)) {
    return extractCalendarSingleResultItem(output);
  }

  if (GOOGLE_WORKSPACE_SINGLE_RESULT_TOOL_TYPES.has(toolType)) {
    return extractGoogleWorkspaceSingleResultItem(output);
  }

  if (NOTION_SINGLE_RESULT_TOOL_TYPES.has(toolType)) {
    return extractNotionSingleResultItem(output);
  }

  if (
    CONFLUENCE_SINGLE_RESULT_TOOL_TYPES.has(toolType) ||
    SHAREPOINT_SINGLE_RESULT_TOOL_TYPES.has(toolType)
  ) {
    return extractAtlassianWikiSingleResultItem(output);
  }

  if (GMAIL_SINGLE_RESULT_TOOL_TYPES.has(toolType)) {
    return extractGmailSingleResultItem(output);
  }

  if (toolType === "tool-gmailSendDraft") {
    return extractGmailSingleResultItem(output);
  }

  return [];
}

export function getConnectionActionResultLabel(
  toolType: ConnectorActionToolType,
  output?: ConnectionActionToolOutput,
  input?: unknown
) {
  if (output?.title?.trim()) {
    return output.title.trim();
  }

  if (output?.summary?.trim()) {
    return output.summary.trim();
  }

  const subject = getOutputStringField(output, "subject");
  if (subject) {
    return subject;
  }

  if (output?.channelName?.trim()) {
    const channelName = output.channelName.trim();
    return channelName.startsWith("#") ? channelName : `#${channelName}`;
  }

  if (output?.name?.trim()) {
    return output.name.trim();
  }

  if (output?.userName?.trim()) {
    return output.userName.trim();
  }

  const contextChips = getConnectionActionContextChips(toolType, input);
  return contextChips.at(0) ?? "Untitled";
}
