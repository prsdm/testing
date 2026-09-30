"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConnectorConnectAction } from "@/components/connectors/connector-action-buttons";
import { useOpenConnectorChat } from "@/lib/connectors/use-open-connector-chat";
import { ConnectorCard } from "./connector-card-layout";
import { ConnectorCardHeading } from "./connector-provider-icon";
import { useConnectorOAuthReturn } from "./use-connector-oauth-return";

type ConnectorStatus = {
  siteConfigured: boolean;
  oauthConfigured: boolean;
  tenantReady: boolean;
  connected: boolean;
  siteUrl: string | null;
  jiraUserEmail: string | null;
  connectUrl: string;
};

export function JiraConnectorCard({
  tenantSlug,
  description,
  initialStatus,
}: {
  tenantSlug: string;
  description: string;
  initialStatus: ConnectorStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const openConnectorChat = useOpenConnectorChat();
  const { error, setError } = useConnectorOAuthReturn({
    connectedMessage: "Jira connected.",
    connectedParam: "jiraConnected",
  });

  async function onDisconnect() {
    setIsDisconnecting(true);
    setError(null);
    const response = await fetch("/api/integrations/jira/disconnect", {
      body: JSON.stringify({ tenantSlug }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to disconnect Jira.");
      setIsDisconnecting(false);
      return;
    }
    setStatus((current) => ({
      ...current,
      connected: false,
      jiraUserEmail: null,
    }));
    toast.success("Jira disconnected.");
    setIsDisconnecting(false);
  }

  const showConnect =
    !status.connected && status.siteConfigured && status.oauthConfigured;

  return (
    <ConnectorCard
      action={
        status.connected || showConnect ? (
          <ConnectorConnectAction
            connected={status.connected}
            connectHref={showConnect ? status.connectUrl : undefined}
            disconnectBusy={isDisconnecting}
            itemLabel="Jira"
            onChat={() => {
              openConnectorChat({
                kind: "provider",
                name: "Jira",
                provider: "jira",
              });
            }}
            onDisconnect={() => {
              onDisconnect().catch(() => undefined);
            }}
          />
        ) : null
      }
      banner={
        <>
          {status.siteConfigured ? null : (
            <p className="mb-2 text-muted-foreground text-sm">
              Jira site is not configured by admin yet. Ask an admin to set it
              on Integrations.
            </p>
          )}
          {status.siteConfigured && !status.oauthConfigured ? (
            <p className="mb-2 text-muted-foreground text-sm">
              OAuth is not configured by admin yet. Ask an admin to add Jira
              OAuth credentials on Integrations.
            </p>
          ) : null}
        </>
      }
      error={error}
    >
      <ConnectorCardHeading description={description} provider="jira" />
    </ConnectorCard>
  );
}
