import type { IntegrationKey } from "@/shared/integrations/integration-catalog";
import type { LatentChatIntegration } from "./chat-integration-availability";

/**
 * Primary chat tool used to surface the Connect CTA for a disconnected
 * user connection (not org admin setup).
 */
export const CONNECT_CTA_TOOL_BY_INTEGRATION: Partial<
  Record<IntegrationKey, string>
> = {
  confluence: "confluenceCreatePage",
  gmail: "gmailSearchMessages",
  "google-calendar": "googleCalendarListEvents",
  "google-drive": "driveCreateFolder",
  jira: "jiraSearchIssues",
  notion: "notionCreatePage",
  sharepoint: "sharePointCreatePage",
  slack: "slackSearchMessages",
};

type ConnectIntentSpec = {
  key: IntegrationKey;
  /** Deterministic match on the user message — not LLM/prompt routing. */
  pattern: RegExp;
};

const CONNECT_INTENT_SPECS: ConnectIntentSpec[] = [
  { key: "jira", pattern: /\bjira\b|\bjql\b/i },
  { key: "slack", pattern: /\bslack\b/i },
  {
    key: "gmail",
    pattern: /\bgmail\b|\binbox\b|\bemails?\b|\bmy\s+mail\b/i,
  },
  { key: "confluence", pattern: /\bconfluence\b/i },
  { key: "notion", pattern: /\bnotion\b/i },
  { key: "sharepoint", pattern: /\bsharepoint\b|\bshare\s*point\b/i },
  {
    key: "google-calendar",
    pattern: /\bgoogle\s*calendar\b|\bcalendar\s+events?\b|\bmy\s+calendar\b/i,
  },
  { key: "google-drive", pattern: /\bgoogle\s*drive\b|\bmy\s+drive\b/i },
];

export function matchConnectIntentKeys(text: string): IntegrationKey[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const matched: IntegrationKey[] = [];
  const seen = new Set<IntegrationKey>();
  for (const spec of CONNECT_INTENT_SPECS) {
    if (!spec.pattern.test(trimmed) || seen.has(spec.key)) {
      continue;
    }
    seen.add(spec.key);
    matched.push(spec.key);
  }
  return matched;
}

export type ConnectCtaInjection = {
  integrationKey: IntegrationKey;
  toolName: string;
  displayName: string;
  connectUrl: string;
  connectLabel: string;
};

/**
 * If the user asked for a provider and their own connection is missing
 * (latent integration), return Connect CTAs to inject into the chat UI.
 */
export function resolveConnectCtasForUserMessage(args: {
  text: string;
  latentIntegrations: LatentChatIntegration[];
}): ConnectCtaInjection[] {
  const intentKeys = matchConnectIntentKeys(args.text);
  if (intentKeys.length === 0 || args.latentIntegrations.length === 0) {
    return [];
  }

  const latentByKey = new Map(
    args.latentIntegrations.map(
      (integration) => [integration.integrationKey, integration] as const
    )
  );

  const ctas: ConnectCtaInjection[] = [];
  for (const key of intentKeys) {
    const latent = latentByKey.get(key);
    const toolName = CONNECT_CTA_TOOL_BY_INTEGRATION[key];
    if (!(latent && toolName)) {
      continue;
    }
    ctas.push({
      connectLabel: latent.connectLabel,
      connectUrl: latent.connectUrl,
      displayName: latent.displayName,
      integrationKey: key,
      toolName,
    });
  }
  return ctas;
}
