"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConnectorConnectAction } from "@/components/connectors/connector-action-buttons";
import { useOpenConnectorChat } from "@/lib/connectors/use-open-connector-chat";
import type { GoogleAppId } from "@/shared/connectors/providers/google-shared/apps";
import { ConnectorCard } from "./connector-card-layout";
import {
  ConnectorCardHeading,
  type ConnectorProvider,
  getConnectorLabel,
} from "./connector-provider-icon";
import { useConnectorOAuthReturn } from "./use-connector-oauth-return";

type GoogleAppConnectorStatus = {
  oauthConfigured: boolean;
  connected: boolean;
  googleAccountEmail: string | null;
  policyError?: string | null;
  connectUrl: string;
  description: string;
  connectLabel: string;
  connectedParam: string;
  uiProvider: ConnectorProvider;
  appId: string;
};

export function GoogleAppConnectorCard({
  tenantSlug,
  initialStatus,
}: {
  tenantSlug: string;
  initialStatus: GoogleAppConnectorStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const openConnectorChat = useOpenConnectorChat();
  const itemLabel = getConnectorLabel(status.uiProvider);
  const { error, setError } = useConnectorOAuthReturn({
    connectedMessage: `${getConnectorLabel(initialStatus.uiProvider)} connected.`,
    connectedParam: initialStatus.connectedParam,
  });

  async function onDisconnect() {
    setIsDisconnecting(true);
    setError(null);

    const response = await fetch("/api/integrations/google-app/disconnect", {
      body: JSON.stringify({ app: status.appId, tenantSlug }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to disconnect.");
      setIsDisconnecting(false);
      return;
    }

    setStatus((current) => ({
      ...current,
      connected: false,
      googleAccountEmail: null,
    }));
    toast.success("Disconnected.");
    setIsDisconnecting(false);
  }

  if (!status.oauthConfigured) {
    return (
      <ConnectorCard>
        <ConnectorCardHeading
          description="Ask admin to configure OAuth"
          provider={status.uiProvider}
        />
      </ConnectorCard>
    );
  }

  return (
    <ConnectorCard
      action={
        <ConnectorConnectAction
          connected={status.connected}
          connectHref={status.connectUrl}
          disconnectBusy={isDisconnecting}
          itemLabel={itemLabel}
          onChat={() => {
            openConnectorChat({
              appId: status.appId as GoogleAppId,
              kind: "google-app",
              name: itemLabel,
              provider: status.uiProvider,
            });
          }}
          onDisconnect={() => {
            onDisconnect().catch(() => undefined);
          }}
        />
      }
      error={error ?? status.policyError}
    >
      <ConnectorCardHeading
        description={status.description}
        provider={status.uiProvider}
      />
    </ConnectorCard>
  );
}
