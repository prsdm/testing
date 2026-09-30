import type { TenantSlackIntegrationSettings } from "@/core/lib/db/tables";
import {
  routeSlackIntegrationEvent,
  type SlackEventEnvelope,
} from "@/core/lib/slack-integration/event-routing";
import {
  processSlackIntegrationAgentMessage,
  processSlackIntegrationAssistantThreadStarted,
} from "@/core/lib/slack-integration/process-agent-message";
import { processSlackIntegrationMention } from "@/core/lib/slack-integration/process-mention";

export type { SlackEventEnvelope } from "@/core/lib/slack-integration/event-routing";
export {
  parseSlackEventEnvelope,
  routeSlackIntegrationEvent,
  shouldHandleSlackIntegrationEvent,
} from "@/core/lib/slack-integration/event-routing";

export async function handleSlackIntegrationEvent(args: {
  settings: TenantSlackIntegrationSettings;
  envelope: SlackEventEnvelope;
}) {
  const route = routeSlackIntegrationEvent(args);
  if (!route.handled || !args.envelope.event) {
    return route;
  }

  try {
    if (route.kind === "app_mention") {
      await processSlackIntegrationMention({
        event: args.envelope.event,
        settings: args.settings,
      });
    } else if (route.kind === "agent_message") {
      await processSlackIntegrationAgentMessage({
        event: args.envelope.event,
        settings: args.settings,
      });
    } else if (route.kind === "assistant_thread_started") {
      await processSlackIntegrationAssistantThreadStarted({
        event: args.envelope.event,
        settings: args.settings,
      });
    }
  } catch (error) {
    console.error("[slack-integration] event handler failed", {
      error,
      kind: route.kind,
    });
  }

  return route;
}
