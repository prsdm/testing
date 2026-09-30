import { getIntegrationCatalogEntry } from "@/shared/integrations/integration-catalog";
import type { LatentChatIntegration } from "./chat-integration-availability";
import {
  CONNECT_CTA_TOOL_BY_INTEGRATION,
  type ConnectCtaInjection,
  matchConnectIntentKeys,
} from "./connect-intent";

export type UserConnectionGate =
  | { kind: "proceed" }
  | {
      kind: "needs_connection";
      ctas: ConnectCtaInjection[];
    };

/**
 * Gate on the user's own connections (not prompt/tool guessing).
 * If they asked for an app and aren't connected, stop before any LLM call.
 */
export function resolveUserConnectionGate(args: {
  text: string;
  /** Integrations where org OAuth is ready and this user has no connection. */
  latentIntegrations: LatentChatIntegration[];
  /** Provider ids this user already has an active connection for. */
  connectedProviderIds: Set<string>;
  /** Optional agent allowlist; empty = no connector CTAs. */
  allowedProviderIds?: string[] | null;
}): UserConnectionGate {
  const intentKeys = matchConnectIntentKeys(args.text);
  if (intentKeys.length === 0) {
    return { kind: "proceed" };
  }

  let latent = args.latentIntegrations;
  if (
    args.allowedProviderIds !== undefined &&
    args.allowedProviderIds !== null
  ) {
    if (args.allowedProviderIds.length === 0) {
      return { kind: "proceed" };
    }
    const allow = new Set(args.allowedProviderIds);
    latent = latent.filter((integration) => allow.has(integration.providerId));
  }

  const latentByKey = new Map(
    latent.map(
      (integration) => [integration.integrationKey, integration] as const
    )
  );

  const ctas: ConnectCtaInjection[] = [];
  const seenProviders = new Set<string>();

  for (const key of intentKeys) {
    const catalog = getIntegrationCatalogEntry(key);
    if (!catalog) {
      continue;
    }
    if (seenProviders.has(catalog.provider)) {
      continue;
    }
    if (args.connectedProviderIds.has(catalog.provider)) {
      continue;
    }
    if (
      args.allowedProviderIds &&
      args.allowedProviderIds.length > 0 &&
      !args.allowedProviderIds.includes(catalog.provider)
    ) {
      continue;
    }

    seenProviders.add(catalog.provider);
    const toolName = CONNECT_CTA_TOOL_BY_INTEGRATION[key];
    if (!toolName) {
      continue;
    }

    const latentMatch = latentByKey.get(key);
    if (latentMatch) {
      ctas.push({
        connectLabel: latentMatch.connectLabel,
        connectUrl: latentMatch.connectUrl,
        displayName: latentMatch.displayName,
        integrationKey: key,
        toolName,
      });
      continue;
    }

    // Not connected and OAuth/connect isn't ready — still don't burn an LLM call.
    ctas.push({
      connectLabel: "Open Connectors",
      connectUrl: "/connectors",
      displayName: catalog.name,
      integrationKey: key,
      toolName,
    });
  }

  if (ctas.length === 0) {
    return { kind: "proceed" };
  }

  return { ctas, kind: "needs_connection" };
}

export function buildConnectionGateAssistantText(ctas: ConnectCtaInjection[]) {
  if (ctas.length === 1) {
    const cta = ctas[0];
    if (!cta) {
      return "Please add a connection to proceed.";
    }
    if (cta.connectLabel.startsWith("Connect ")) {
      return `Connect ${cta.displayName} to continue.`;
    }
    return `${cta.displayName} isn't connected for your account yet. Open Connectors to finish setup (your admin may need to enable it first).`;
  }

  const connectable = ctas.filter((cta) =>
    cta.connectLabel.startsWith("Connect ")
  );
  const setupOnly = ctas.filter(
    (cta) => !cta.connectLabel.startsWith("Connect ")
  );
  const parts: string[] = [];
  if (connectable.length > 0) {
    parts.push(
      `Connect these apps to continue: ${connectable
        .map((cta) => cta.displayName)
        .join(", ")}.`
    );
  }
  if (setupOnly.length > 0) {
    parts.push(
      `${setupOnly.map((cta) => cta.displayName).join(", ")} ${
        setupOnly.length === 1 ? "needs" : "need"
      } workspace setup before you can connect.`
    );
  }
  return parts.join(" ");
}
