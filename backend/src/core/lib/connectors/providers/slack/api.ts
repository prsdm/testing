type SlackApiResponse = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

export class SlackApiError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(SlackApiError.messageForCode(code));
    this.name = "SlackApiError";
    this.code = code;
  }

  static messageForCode(code: string) {
    if (
      code === "token_revoked" ||
      code === "token_expired" ||
      code === "invalid_auth" ||
      code === "not_authed" ||
      code === "account_inactive"
    ) {
      return "Slack connection expired. Reconnect Slack.";
    }
    if (code === "channel_not_found") {
      return "Slack channel not found. Call slackListChannels first and use a channel id or exact name from that result.";
    }
    if (code === "not_in_channel") {
      return "You are not a member of that Slack channel. Join it in Slack or use a channel from slackListChannels.";
    }
    return `Slack API error: ${code}`;
  }
}

export async function slackApi<T extends SlackApiResponse>(
  method: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    body: params ? new URLSearchParams(params) : undefined,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Slack API request failed (${response.status}).`);
  }
  const data = (await response.json()) as T;
  if (!data.ok) {
    const code = data.error ?? "unknown_error";
    throw new SlackApiError(code);
  }
  return data;
}

export function slackMessagePermalink(args: {
  teamUrl: string | null;
  channelId: string;
  ts: string;
}) {
  const base = args.teamUrl?.replace(/\/$/, "");
  if (!base) {
    return;
  }
  const tsCompact = args.ts.replace(".", "");
  return `${base}/archives/${args.channelId}/p${tsCompact}`;
}
