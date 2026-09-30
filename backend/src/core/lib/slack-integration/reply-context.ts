/** Where Kimiro should post in Slack for an app_mention event. */
export type SlackReplyContext = {
  messageTs: string;
  /** Pass to Slack `thread_ts` when replying inside a thread; omit for channel-level. */
  replyThreadTs: string | null;
  /** Stable key for Kimiro chat mapping (`TenantSlackIntegrationThread.slackThreadTs`). */
  conversationKey: string;
};

export function resolveSlackReplyContext(event: {
  ts?: string;
  thread_ts?: string;
}): SlackReplyContext | null {
  const messageTs = event.ts?.trim();
  if (!messageTs) {
    return null;
  }

  const parentThreadTs = event.thread_ts?.trim();
  if (!parentThreadTs) {
    return {
      conversationKey: messageTs,
      messageTs,
      replyThreadTs: null,
    };
  }

  return {
    conversationKey: parentThreadTs,
    messageTs,
    replyThreadTs: parentThreadTs,
  };
}

/** Agent tab / DM messages always continue in the agent thread. */
export function resolveSlackAgentReplyContext(event: {
  ts?: string;
  thread_ts?: string;
}): SlackReplyContext | null {
  const messageTs = event.ts?.trim();
  if (!messageTs) {
    return null;
  }

  const threadTs = event.thread_ts?.trim() ?? messageTs;
  return {
    conversationKey: threadTs,
    messageTs,
    replyThreadTs: threadTs,
  };
}
