"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConnectorConnectAction } from "@/components/connectors/connector-action-buttons";
import { useOpenConnectorChat } from "@/lib/connectors/use-open-connector-chat";
import { ConnectorCard } from "./connector-card-layout";
import { ConnectorCardHeading } from "./connector-provider-icon";
import { useConnectorOAuthReturn } from "./use-connector-oauth-return";

type ConnectorStatus = {
  oauthConfigured: boolean;
  connected: boolean;
  slackUserEmail: string | null;
  teamName: string | null;
  connectUrl: string;
};

export function SlackConnectorCard({
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
    connectedMessage: "Slack connected.",
    connectedParam: "slackConnected",
  });

  async function onDisconnect() {
    setIsDisconnecting(true);
    setError(null);
    const response = await fetch("/api/integrations/slack/disconnect", {
      body: JSON.stringify({ tenantSlug }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to disconnect Slack.");
      setIsDisconnecting(false);
      return;
    }
    setStatus((current) => ({
      ...current,
      connected: false,
      slackUserEmail: null,
      teamName: null,
    }));
    toast.success("Slack disconnected.");
    setIsDisconnecting(false);
  }

  return (
    <ConnectorCard
      action={
        status.oauthConfigured ? (
          <ConnectorConnectAction
            connected={status.connected}
            connectHref={status.connectUrl}
            disconnectBusy={isDisconnecting}
            itemLabel="Slack"
            onChat={() => {
              openConnectorChat({
                kind: "provider",
                name: "Slack",
                provider: "slack",
              });
            }}
            onDisconnect={() => {
              onDisconnect().catch(() => undefined);
            }}
          />
        ) : null
      }
      banner={
        status.oauthConfigured ? null : (
          <p className="mb-2 text-muted-foreground text-sm">
            OAuth is not configured by admin yet. Ask an admin to add Slack
            OAuth credentials on Integrations.
          </p>
        )
      }
      error={error}
    >
      <ConnectorCardHeading description={description} provider="slack" />
    </ConnectorCard>
  );
}
