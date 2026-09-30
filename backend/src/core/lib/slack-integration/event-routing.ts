import type { TenantSlackIntegrationSettings } from "@/core/lib/db/tables";

export type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    channel?: string;
    channel_type?: string;
    user?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    subtype?: string;
  };
  team_id?: string;
};

export type SlackIntegrationEventRoute =
  | { handled: false; reason: string }
  | { handled: true; kind: "app_mention" }
  | { handled: true; kind: "agent_message" }
  | { handled: true; kind: "assistant_thread_started" };

export function parseSlackEventEnvelope(
  rawBody: string
): SlackEventEnvelope | null {
  try {
    return JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return null;
  }
}

function isDmChannel(channelType: string | undefined) {
  return channelType === "im";
}

function channelAllowed(
  settings: Pick<
    TenantSlackIntegrationSettings,
    "allowedChannelIds" | "dmsEnabled"
  >,
  channelId: string | undefined,
  channelType: string | undefined
) {
  if (!channelId) {
    return false;
  }
  if (isDmChannel(channelType)) {
    return settings.dmsEnabled;
  }
  const allowed = settings.allowedChannelIds ?? [];
  if (allowed.length === 0) {
    return false;
  }
  return allowed.includes(channelId);
}

function isIgnorableMessageEvent(
  event: NonNullable<SlackEventEnvelope["event"]>
) {
  if (event.bot_id) {
    return true;
  }
  if (event.subtype && event.subtype !== "file_share") {
    return true;
  }
  return false;
}

export function routeSlackIntegrationEvent(args: {
  settings: TenantSlackIntegrationSettings;
  envelope: SlackEventEnvelope;
}): SlackIntegrationEventRoute {
  if (!args.settings.enabled || !args.settings.botTokenEncrypted) {
    return { handled: false, reason: "bot_disabled" };
  }

  const event = args.envelope.event;
  if (!event) {
    return { handled: false, reason: "no_event" };
  }

  if (event.type === "assistant_thread_started") {
    return { handled: true, kind: "assistant_thread_started" };
  }

  if (event.type === "message" && isDmChannel(event.channel_type)) {
    if (isIgnorableMessageEvent(event)) {
      return { handled: false, reason: "ignored_bot_message" };
    }
    if (!args.settings.dmsEnabled) {
      return { handled: false, reason: "channel_not_allowed" };
    }
    return { handled: true, kind: "agent_message" };
  }

  if (event.type !== "app_mention") {
    return { handled: false, reason: "ignored_event_type" };
  }

  if (event.bot_id || event.subtype) {
    return { handled: false, reason: "ignored_bot_message" };
  }

  if (!channelAllowed(args.settings, event.channel, event.channel_type)) {
    return { handled: false, reason: "channel_not_allowed" };
  }

  return { handled: true, kind: "app_mention" };
}

/** @deprecated Use routeSlackIntegrationEvent */
export function shouldHandleSlackIntegrationEvent(args: {
  settings: TenantSlackIntegrationSettings;
  envelope: SlackEventEnvelope;
}) {
  const route = routeSlackIntegrationEvent(args);
  if (!route.handled) {
    return route;
  }
  return { handled: true, reason: "accepted" } as const;
}
