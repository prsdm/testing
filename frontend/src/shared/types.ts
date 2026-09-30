import { z } from "zod";
import type { ArtifactKind } from "@/contracts/artifact";
import type { Suggestion } from "@/contracts/documents";
import { ASSISTANT_ICON_COLORS } from "@/shared/chat/assistant-brand";
import {
  THREAD_TAG_MAX_COUNT,
  threadTagSchema,
} from "@/shared/chat/thread-tags";
import {
  composerConnectorFocusesSchema,
  composerConnectorFocusSchema,
} from "@/shared/connectors/composer-connector-focus-schema";
import { composerInlineBodySchema } from "@/shared/connectors/composer-inline-body-schema";
import type {
  CreateChartToolInput,
  CreateChartToolOutput,
} from "./ai/tools/create-chart";
import type { InternalSearchToolOutput } from "./search/citations";

export const messageConnectCtaSchema = z.object({
  connectLabel: z.string(),
  connectUrl: z.string(),
  displayName: z.string(),
  integrationKey: z.string(),
});

export const messageMetadataSchema = z.object({
  agentIconColor: z.enum(ASSISTANT_ICON_COLORS).nullable().optional(),
  agentId: z.string().uuid().optional(),
  agentName: z.string().optional(),
  agentSlug: z.string().optional(),
  authorAuthUserId: z.string().optional(),
  authorDisplayName: z.string().optional(),
  authorEmail: z.string().optional(),
  authorImage: z.string().nullable().optional(),
  /** User-visible instruction when documentSelection was attached. */
  composerText: z.string().optional(),
  /** Primary @-mention / Connectors → Chat focus (legacy single). */
  composerConnectorFocus: composerConnectorFocusSchema.optional(),
  /** All @-mention tool scopes for this user message (union of tools on the turn). */
  composerConnectorFocuses: composerConnectorFocusesSchema,
  /** Inline connector chips + text as composed in the input. */
  composerInlineBody: composerInlineBodySchema.optional(),
  /** User-level connect prompts rendered in the response body (not activity). */
  connectCtas: z.array(messageConnectCtaSchema).optional(),
  createdAt: z.string().optional(),
  /** Document passage attached via Edit with AI (composer chip). */
  documentSelection: z
    .object({
      documentId: z.string(),
      text: z.string(),
      title: z.string(),
    })
    .optional(),
  editedAt: z.string().optional(),
  modelId: z.string().optional(),
  /** Pending tool call awaiting approval or rejection. */
  pendingToolApproval: z
    .object({
      approvalId: z.string().optional(),
      args: z.record(z.string(), z.unknown()).optional(),
      toolCallId: z.string(),
      toolName: z.string(),
    })
    .optional(),
  /** Prevents repeatedly nudging a plan-only turn after reload/navigation. */
  todoExecutionNudged: z.boolean().optional(),
  /** Prevents repeatedly nudging when open todo steps remain after a final answer. */
  todoPendingStepsNudged: z.boolean().optional(),
  /** Links a resumed run to the same billing row (approve/reject after suspend). */
  usageEventId: z.string().uuid().optional(),
  /** Durable chat turn run id. */
  workflowRunId: z.string().optional(),
  /** User message that this assistant response answers. */
  replyToMessageId: z.string().uuid().optional(),
  workflowRunStatus: z
    .enum(["pending", "running", "suspended", "success", "failed", "cancelled"])
    .optional(),
  /** Channel thread labels on the root message. */
  threadTags: z.array(threadTagSchema).max(THREAD_TAG_MAX_COUNT).optional(),
  /** Inbox list title for the thread root (optional override). */
  threadTitle: z.string().max(120).optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type sourceSearchTool = {
  input: { query: string };
  output: InternalSearchToolOutput;
};
type peopleSearchTool = {
  input: { query: string };
  output: {
    query: string;
    people: Array<{
      name: string;
      email: string;
      jobTitle: string | null;
      department: string | null;
    }>;
  };
};
type createChartTool = {
  input: CreateChartToolInput;
  output: CreateChartToolOutput | { error: string };
};
type saveToLibraryTool = {
  input: {
    filename: string;
    content?: string;
    sandboxPath?: string;
    contentType?: string;
    contentEncoding?: "utf8" | "base64";
  };
  output:
    | {
        id: string;
        name: string;
        contentType: string;
        sizeBytes: number;
        url: string;
        contextForLlm: string;
      }
    | { error: string; contextForLlm?: string };
};
type listLibraryTool = {
  input: { limit?: number };
  output: {
    files: Array<{
      id: string;
      name: string;
      contentType: string;
      sizeBytes: number;
      url: string;
      source: string;
      createdAt: string;
    }>;
    contextForLlm: string;
  };
};
type generateImageTool = {
  input: import("./ai/tools/generate-image").GenerateImageToolInput;
  output:
    | import("./ai/tools/generate-image").GenerateImageToolOutput
    | { error: string; contextForLlm?: string };
};
type sandboxExecTool = {
  input: import("./ai/tools/sandbox-exec").SandboxExecToolInput;
  output:
    | import("./ai/tools/sandbox-exec").SandboxExecToolOutput
    | { error: string; contextForLlm?: string };
};
type importLibraryToSandboxTool = {
  input: { libraryFileId: string; sandboxPath?: string };
  output:
    | {
        libraryFileId: string;
        sandboxPath: string;
        sizeBytes: number;
        reusedExisting: boolean;
        contextForLlm: string;
      }
    | { error: string; contextForLlm?: string };
};
type createDocumentTool = {
  input: {
    title: string;
    kind: ArtifactKind;
    instructions?: string;
  };
  output: {
    id: string;
    title: string;
    kind: ArtifactKind;
    content: string;
  };
};
type updateDocumentTool = {
  input: {
    id: string;
    description: string;
    selectedText?: string;
  };
  output:
    | {
        id: string;
        title: string;
        kind: ArtifactKind;
        content: string;
      }
    | { error: string };
};

type DriveGetFileTool = {
  input: {
    fileId?: string;
    fileName?: string;
    includeContent?: boolean;
  };
  output: Record<string, unknown>;
};
type DriveListFoldersTool = {
  input: {
    parentId?: string;
    pageToken?: string;
    limit?: number;
  };
  output: Record<string, unknown>;
};
type DriveSearchFilesTool = {
  input: {
    query: string;
    folderOnly?: boolean;
    limit?: number;
  };
  output: Record<string, unknown>;
};
type DriveCreateFolderTool = {
  input: { name: string; parentId?: string };
  output: Record<string, unknown>;
};
type DriveCreateSharedDriveTool = {
  input: { name: string; requestId?: string };
  output: Record<string, unknown>;
};
type DriveUploadFileTool = {
  input: {
    name: string;
    content: string;
    mimeType: string;
    isBase64?: boolean;
    folderId?: string;
    description?: string;
  };
  output: Record<string, unknown>;
};
type DriveMoveFileTool = {
  input: {
    fileId?: string;
    fileName?: string;
    fromFolderId?: string;
    toFolderId?: string;
    toFolderName?: string;
  };
  output: Record<string, unknown>;
};
type DriveUpdateFileTool = {
  input: {
    fileId?: string;
    fileName?: string;
    name?: string;
    description?: string;
    starred?: boolean;
    trashed?: boolean;
  };
  output: Record<string, unknown>;
};
type ConfluenceCreateSpaceTool = {
  input: {
    spaceKey: string;
    name: string;
    description?: string;
    isPrivate?: boolean;
  };
  output: Record<string, unknown>;
};
type ConfluenceCreatePageTool = {
  input: {
    spaceKey: string;
    title: string;
    content?: string;
    parentPageId?: string;
    parentPageTitle?: string;
  };
  output: Record<string, unknown>;
};
type ConfluenceRenamePageTool = {
  input: {
    pageId?: string;
    pageTitle?: string;
    spaceKey?: string;
    title: string;
  };
  output: Record<string, unknown>;
};
type ConfluenceUpdatePageTool = {
  input: {
    pageId?: string;
    pageTitle?: string;
    spaceKey?: string;
    content: string;
    contentMode?: "append" | "replace";
  };
  output: Record<string, unknown>;
};
type ConfluenceMovePageTool = {
  input: {
    pageId?: string;
    pageTitle?: string;
    spaceKey?: string;
    parentPageId?: string;
    parentPageTitle?: string;
  };
  output: Record<string, unknown>;
};
type SharePointCreatePageTool = {
  input: {
    siteId?: string;
    siteUrl?: string;
    siteName?: string;
    title: string;
    content?: string;
  };
  output: Record<string, unknown>;
};
type SharePointRenamePageTool = {
  input: {
    siteId?: string;
    siteUrl?: string;
    siteName?: string;
    pageId?: string;
    pageTitle?: string;
    title: string;
  };
  output: Record<string, unknown>;
};
type SharePointUpdatePageTool = {
  input: {
    siteId?: string;
    siteUrl?: string;
    siteName?: string;
    pageId?: string;
    pageTitle?: string;
    content: string;
    contentMode?: "append" | "replace";
  };
  output: Record<string, unknown>;
};
type SlackListChannelsTool = {
  input: { limit?: number; cursor?: string };
  output: Record<string, unknown>;
};
type SlackListUsersTool = {
  input: { cursor?: string };
  output: Record<string, unknown>;
};
type SlackSearchMessagesTool = {
  input: { query: string; count?: number };
  output: Record<string, unknown>;
};
type SlackGetConversationHistoryTool = {
  input: {
    channelId?: string;
    channelName?: string;
    limit?: number;
    cursor?: string;
    oldest?: string;
    latest?: string;
  };
  output: Record<string, unknown>;
};
type SlackGetDirectMessageHistoryTool = {
  input: {
    user: string;
    limit?: number;
    cursor?: string;
    oldest?: string;
    latest?: string;
  };
  output: Record<string, unknown>;
};
type SlackGetThreadRepliesTool = {
  input: {
    channelId?: string;
    channelName?: string;
    threadTs: string;
    limit?: number;
    cursor?: string;
  };
  output: Record<string, unknown>;
};
type SlackPostMessageTool = {
  input: {
    channelId?: string;
    channelName?: string;
    text: string;
  };
  output: Record<string, unknown>;
};
type SlackPostDirectMessageTool = {
  input: { user: string; text: string };
  output: Record<string, unknown>;
};
type SlackUpdateMessageTool = {
  input: {
    channelId?: string;
    channelName?: string;
    messageTs: string;
    text: string;
  };
  output: Record<string, unknown>;
};
type SlackCreateChannelTool = {
  input: { name: string; isPrivate?: boolean };
  output: Record<string, unknown>;
};
type JiraListProjectsTool = {
  input: { query?: string; startAt?: number; maxResults?: number };
  output: Record<string, unknown>;
};
type JiraSearchIssuesTool = {
  input: { jql: string; startAt?: number; maxResults?: number };
  output: Record<string, unknown>;
};
type JiraGetIssueTool = {
  input: { issueIdOrKey: string; fields?: string };
  output: Record<string, unknown>;
};
type JiraCreateIssueTool = {
  input: {
    projectKey: string;
    summary: string;
    issueType: string;
    description?: string;
  };
  output: Record<string, unknown>;
};
type JiraUpdateIssueTool = {
  input: {
    issueIdOrKey: string;
    summary?: string;
    description?: string;
  };
  output: Record<string, unknown>;
};
type JiraListTransitionsTool = {
  input: { issueIdOrKey: string };
  output: Record<string, unknown>;
};
type JiraTransitionIssueTool = {
  input: { issueIdOrKey: string; transitionId: string };
  output: Record<string, unknown>;
};
type JiraAddCommentTool = {
  input: { issueIdOrKey: string; body: string };
  output: Record<string, unknown>;
};
type NotionCreatePageTool = {
  input: {
    parentPageId?: string;
    parentPageTitle?: string;
    title: string;
    content?: string;
  };
  output: Record<string, unknown>;
};
type NotionCreateDatabaseTool = {
  input: {
    parentPageId?: string;
    parentPageTitle?: string;
    title: string;
    properties?: string;
  };
  output: Record<string, unknown>;
};
type NotionRenamePageTool = {
  input: {
    pageId?: string;
    pageTitle?: string;
    title: string;
  };
  output: Record<string, unknown>;
};
type NotionUpdatePageTool = {
  input: {
    pageId?: string;
    pageTitle?: string;
    content: string;
    contentMode?: "append" | "replace";
  };
  output: Record<string, unknown>;
};
type NotionMovePageTool = {
  input: {
    pageId?: string;
    pageTitle?: string;
    parentPageId?: string;
    parentPageTitle?: string;
  };
  output: Record<string, unknown>;
};
type NotionDbCreateRowTool = {
  input: {
    databaseId?: string;
    databaseTitle?: string;
    title: string;
    properties?: string;
    content?: string;
  };
  output: Record<string, unknown>;
};
type NotionDbRenameRowTool = {
  input: {
    databaseId?: string;
    databaseTitle?: string;
    rowId?: string;
    rowTitle?: string;
    title: string;
  };
  output: Record<string, unknown>;
};
type NotionDbUpdateRowTool = {
  input: {
    databaseId?: string;
    databaseTitle?: string;
    rowId?: string;
    rowTitle?: string;
    properties?: string;
    content?: string;
    contentMode?: "append" | "replace";
  };
  output: Record<string, unknown>;
};
type NotionDbMoveRowTool = {
  input: {
    databaseId?: string;
    databaseTitle?: string;
    rowId?: string;
    rowTitle?: string;
    toDatabaseId?: string;
    toDatabaseTitle?: string;
    toParentPageId?: string;
    toParentPageTitle?: string;
  };
  output: Record<string, unknown>;
};
type GmailListMessagesTool = {
  input: { labelId?: string; maxResults?: number; pageToken?: string };
  output: Record<string, unknown>;
};
type GmailSearchMessagesTool = {
  input: { query: string; maxResults?: number; pageToken?: string };
  output: Record<string, unknown>;
};
type GmailGetMessageTool = {
  input: { messageId: string };
  output: Record<string, unknown>;
};
type GmailGetThreadTool = {
  input: { threadId: string; maxMessages?: number };
  output: Record<string, unknown>;
};
type GmailSendMessageTool = {
  input: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
  };
  output: Record<string, unknown>;
};
type GmailReplyToMessageTool = {
  input: { messageId: string; body: string; replyAll?: boolean };
  output: Record<string, unknown>;
};
type GmailCreateDraftTool = {
  input: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    threadId?: string;
  };
  output: Record<string, unknown>;
};
type GmailSendDraftTool = {
  input: { draftId: string };
  output: Record<string, unknown>;
};
type GoogleCalendarListCalendarsTool = {
  input: { maxResults?: number; pageToken?: string };
  output: Record<string, unknown>;
};
type GoogleCalendarListEventsTool = {
  input: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    query?: string;
    maxResults?: number;
    pageToken?: string;
  };
  output: Record<string, unknown>;
};
type GoogleCalendarGetEventTool = {
  input: { calendarId?: string; eventId: string };
  output: Record<string, unknown>;
};
type GoogleCalendarCreateEventTool = {
  input: {
    calendarId?: string;
    summary: string;
    description?: string;
    location?: string;
    startDateTime?: string;
    endDateTime?: string;
    startDate?: string;
    endDate?: string;
    timeZone?: string;
    attendees?: string;
  };
  output: Record<string, unknown>;
};
type GoogleCalendarUpdateEventTool = {
  input: {
    calendarId?: string;
    eventId: string;
    summary?: string;
    description?: string;
    location?: string;
    startDateTime?: string;
    endDateTime?: string;
    startDate?: string;
    endDate?: string;
    timeZone?: string;
    attendees?: string;
  };
  output: Record<string, unknown>;
};
type GoogleCalendarDeleteEventTool = {
  input: { calendarId?: string; eventId: string };
  output: Record<string, unknown>;
};
type WebSearchTool = {
  input: { query: string };
  output: {
    query: string;
    results: Array<{ title: string; url: string; snippet: string }>;
    error?: string;
  };
};
/** Legacy — historical messages only; tool is no longer registered. */
type OpenUrlTool = {
  input: { urls: string[] };
  output: {
    urls: string[];
    results: Array<{
      url: string;
      title: string;
      content: string;
      error?: string;
    }>;
    error?: string;
  };
};

export type ChatTools = {
  sourceSearch: sourceSearchTool;
  peopleSearch: peopleSearchTool;
  createChart: createChartTool;
  saveToLibrary: saveToLibraryTool;
  listLibrary: listLibraryTool;
  generateImage: generateImageTool;
  importLibraryToSandbox: importLibraryToSandboxTool;
  sandboxExec: sandboxExecTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  driveListFolders: DriveListFoldersTool;
  driveSearchFiles: DriveSearchFilesTool;
  driveGetFile: DriveGetFileTool;
  driveCreateFolder: DriveCreateFolderTool;
  driveCreateSharedDrive: DriveCreateSharedDriveTool;
  driveUploadFile: DriveUploadFileTool;
  driveMoveFile: DriveMoveFileTool;
  driveUpdateFile: DriveUpdateFileTool;
  gmailListMessages: GmailListMessagesTool;
  gmailSearchMessages: GmailSearchMessagesTool;
  gmailGetMessage: GmailGetMessageTool;
  gmailGetThread: GmailGetThreadTool;
  gmailSendMessage: GmailSendMessageTool;
  gmailCreateDraft: GmailCreateDraftTool;
  gmailSendDraft: GmailSendDraftTool;
  gmailReplyToMessage: GmailReplyToMessageTool;
  googleCalendarListCalendars: GoogleCalendarListCalendarsTool;
  googleCalendarListEvents: GoogleCalendarListEventsTool;
  googleCalendarGetEvent: GoogleCalendarGetEventTool;
  googleCalendarCreateEvent: GoogleCalendarCreateEventTool;
  googleCalendarUpdateEvent: GoogleCalendarUpdateEventTool;
  googleCalendarDeleteEvent: GoogleCalendarDeleteEventTool;
  confluenceCreateSpace: ConfluenceCreateSpaceTool;
  confluenceCreatePage: ConfluenceCreatePageTool;
  confluenceRenamePage: ConfluenceRenamePageTool;
  confluenceUpdatePage: ConfluenceUpdatePageTool;
  confluenceMovePage: ConfluenceMovePageTool;
  sharePointCreatePage: SharePointCreatePageTool;
  sharePointRenamePage: SharePointRenamePageTool;
  sharePointUpdatePage: SharePointUpdatePageTool;
  slackListChannels: SlackListChannelsTool;
  slackListUsers: SlackListUsersTool;
  slackSearchMessages: SlackSearchMessagesTool;
  slackGetConversationHistory: SlackGetConversationHistoryTool;
  slackGetDirectMessageHistory: SlackGetDirectMessageHistoryTool;
  slackGetThreadReplies: SlackGetThreadRepliesTool;
  slackPostMessage: SlackPostMessageTool;
  slackPostDirectMessage: SlackPostDirectMessageTool;
  slackUpdateMessage: SlackUpdateMessageTool;
  slackCreateChannel: SlackCreateChannelTool;
  jiraListProjects: JiraListProjectsTool;
  jiraSearchIssues: JiraSearchIssuesTool;
  jiraGetIssue: JiraGetIssueTool;
  jiraCreateIssue: JiraCreateIssueTool;
  jiraUpdateIssue: JiraUpdateIssueTool;
  jiraListTransitions: JiraListTransitionsTool;
  jiraTransitionIssue: JiraTransitionIssueTool;
  jiraAddComment: JiraAddCommentTool;
  notionCreatePage: NotionCreatePageTool;
  notionCreateDatabase: NotionCreateDatabaseTool;
  notionRenamePage: NotionRenamePageTool;
  notionUpdatePage: NotionUpdatePageTool;
  notionMovePage: NotionMovePageTool;
  notionDbCreateRow: NotionDbCreateRowTool;
  notionDbRenameRow: NotionDbRenameRowTool;
  notionDbUpdateRow: NotionDbUpdateRowTool;
  notionDbMoveRow: NotionDbMoveRowTool;
  webSearch: WebSearchTool;
  openUrl: OpenUrlTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
};

export type DataUIPart<T extends Record<string, unknown> = CustomUIDataTypes> =
  {
    [K in keyof T]: {
      type: `data-${K & string}`;
      data: T[K];
      id?: string;
      transient?: boolean;
    };
  }[keyof T];

export type ChatDataUIPart = DataUIPart<CustomUIDataTypes>;

export type FileUIPart = {
  type: "file";
  mediaType: string;
  filename?: string;
  name?: string;
  url: string;
};

export type SourceUrlUIPart = {
  type: "source-url";
  url: string;
  title?: string;
};

export type SourceDocumentUIPart = {
  type: "source-document";
  sourceId: string;
  title?: string;
  mediaType?: string;
};

export type ChatMessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string; state?: "streaming" | "done" }
  | FileUIPart
  | SourceUrlUIPart
  | SourceDocumentUIPart
  | ChatDataUIPart
  | {
      type: `tool-${string}`;
      toolCallId: string;
      state:
        | "input-streaming"
        | "input-available"
        | "approval-requested"
        | "approval-responded"
        | "output-available"
        | "output-denied"
        | "output-error";
      input?: unknown;
      output?: unknown;
      errorText?: string;
      approval?: {
        id: string;
        approved?: boolean;
        reason?: string;
      };
      originalToolName?: string;
    };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: ChatMessagePart[];
  metadata?: MessageMetadata;
  threadRootMessageId?: string | null;
};

/** @deprecated alias — prefer ChatRunStatus from lib/chat/chat-helpers */
export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
