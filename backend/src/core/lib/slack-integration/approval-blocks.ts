import {
  type ConnectorActionToolType,
  getConnectionActionToolMeta,
  isConnectorActionToolType,
} from "@/shared/chat/connector-action-tools";
import {
  getToolApprovalHeadline,
  getToolApprovalWarning,
} from "@/shared/chat/tool-approval-display";

export type SlackIntegrationApprovalPayload = {
  tenantId: string;
  chatId: string;
  workflowRunId: string;
  assistantMessageId: string;
  approvalId: string;
  channelId: string;
  /** Kimiro conversation key (`TenantSlackIntegrationThread.slackThreadTs`). */
  threadTs: string;
  /** Slack `thread_ts` for replies; null/omitted for channel-level. */
  replyThreadTs?: string | null;
  toolName?: string;
  /** Human-readable action label shown in Slack (not the raw tool id). */
  displayLabel?: string;
};

const CONNECTOR_PROVIDER_LABELS: Record<string, string> = {
  confluence: "Confluence",
  gmail: "Gmail",
  "google-calendar": "Google Calendar",
  "google-drive": "Google Drive",
  jira: "Jira",
  notion: "Notion",
  sharepoint: "SharePoint",
  slack: "Slack",
};

function connectorProviderLabel(provider: string) {
  return CONNECTOR_PROVIDER_LABELS[provider] ?? provider;
}

function truncateSlackText(text: string, maxLen: number) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export function buildSlackIntegrationApprovalDisplay(args: {
  toolName: string;
  toolArgs?: Record<string, unknown>;
  userMessageText?: string;
}) {
  const toolName = args.toolName.trim();
  const headline = getToolApprovalHeadline(toolName, args.toolArgs);
  const warning = getToolApprovalWarning(
    toolName,
    args.toolArgs,
    args.userMessageText
  );

  const connectorType = `tool-${toolName}` as ConnectorActionToolType;
  let subtitle = "Kimiro needs your approval";
  if (isConnectorActionToolType(connectorType)) {
    const meta = getConnectionActionToolMeta(connectorType);
    subtitle = `${connectorProviderLabel(meta.provider)} · Approval required`;
  }

  const body =
    warning ??
    "Review this action below. Kimiro will continue after you approve.";

  return {
    body: truncateSlackText(body, 500),
    fallbackText: `Approval required: ${headline}`,
    headline: truncateSlackText(headline, 150),
    subtitle: truncateSlackText(subtitle, 150),
  };
}

export function encodeSlackIntegrationApprovalPayload(
  payload: SlackIntegrationApprovalPayload
) {
  return JSON.stringify(payload);
}

export function decodeSlackIntegrationApprovalPayload(
  value: string | undefined
): SlackIntegrationApprovalPayload | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as SlackIntegrationApprovalPayload;
    if (
      !(
        parsed.tenantId &&
        parsed.chatId &&
        parsed.workflowRunId &&
        parsed.assistantMessageId &&
        parsed.approvalId &&
        parsed.channelId &&
        parsed.threadTs
      )
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveSlackIntegrationApprovalDisplayLabel(args: {
  payload: SlackIntegrationApprovalPayload;
  toolArgs?: Record<string, unknown>;
}) {
  const fromPayload = args.payload.displayLabel?.trim();
  if (fromPayload) {
    return fromPayload;
  }

  const toolName =
    args.payload.toolName?.trim() ||
    args.toolArgs?.toolName?.toString().trim() ||
    "";
  if (!toolName) {
    return "this action";
  }

  return getToolApprovalHeadline(toolName, args.toolArgs);
}

export function buildSlackIntegrationApprovalBlocks(args: {
  toolName: string;
  toolArgs?: Record<string, unknown>;
  userMessageText?: string;
  payload: SlackIntegrationApprovalPayload;
}) {
  const display = buildSlackIntegrationApprovalDisplay({
    toolArgs: args.toolArgs,
    toolName: args.toolName,
    userMessageText: args.userMessageText,
  });
  const encoded = encodeSlackIntegrationApprovalPayload({
    ...args.payload,
    displayLabel: display.headline,
    toolName: args.toolName,
  });

  return [
    {
      block_id: `slack_integration_approval_${args.payload.approvalId}`,
      body: {
        text: display.body,
        type: "mrkdwn",
        verbatim: false,
      },
      subtitle: {
        text: display.subtitle,
        type: "mrkdwn",
        verbatim: false,
      },
      title: {
        text: display.headline,
        type: "mrkdwn",
        verbatim: false,
      },
      type: "card",
    },
    {
      block_id: `slack_integration_approval_actions_${args.payload.approvalId}`,
      elements: [
        {
          action_id: "slack_integration_approve",
          style: "primary",
          text: { emoji: false, text: "Approve", type: "plain_text" },
          type: "button",
          value: encoded,
        },
        {
          action_id: "slack_integration_deny",
          style: "danger",
          text: { emoji: false, text: "Deny", type: "plain_text" },
          type: "button",
          value: encoded,
        },
      ],
      type: "actions",
    },
  ] satisfies Record<string, unknown>[];
}

export function buildSlackIntegrationApprovalFallbackText(args: {
  toolName: string;
  toolArgs?: Record<string, unknown>;
  userMessageText?: string;
}) {
  return buildSlackIntegrationApprovalDisplay(args).fallbackText;
}

export function buildSlackIntegrationApprovalResolvedBlocks(args: {
  displayLabel: string;
  approved: boolean;
}) {
  const label = args.displayLabel.trim() || "This action";
  const title = args.approved ? "Approved" : "Denied";
  // Headline already reads as an action phrase (e.g. "Sending email admin@…").
  const body = args.approved ? label : `${label} was canceled.`;

  return [
    {
      block_id: "slack_integration_approval_resolved",
      body: {
        text: body,
        type: "mrkdwn",
        verbatim: false,
      },
      title: {
        text: title,
        type: "mrkdwn",
        verbatim: false,
      },
      type: "card",
    },
  ] satisfies Record<string, unknown>[];
}

export function buildSlackIntegrationApprovalResolvedText(args: {
  displayLabel: string;
  approved: boolean;
}) {
  const label = args.displayLabel.trim() || "This action";
  return args.approved
    ? `Approved. ${label}`
    : `Denied. ${label} was canceled.`;
}
