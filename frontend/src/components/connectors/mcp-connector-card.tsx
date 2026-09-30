"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import { ConnectorConnectAction } from "@/components/connectors/connector-action-buttons";
import { McpIcon } from "@/components/icons/mcp-icon";
import { useOpenConnectorChat } from "@/lib/connectors/use-open-connector-chat";
import { ConnectorCard } from "./connector-card-layout";

type McpConnectorStatus = {
  serverId: string;
  connected: boolean;
  serverConfigured: boolean;
  transport: "sse" | "streamable_http";
};

export function McpConnectorCard({
  name,
  description,
  tenantSlug,
  initialStatus,
}: {
  name: string;
  description: string;
  tenantSlug: string;
  initialStatus: McpConnectorStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openConnectorChat = useOpenConnectorChat();

  async function toggleConnection(connect: boolean) {
    setIsBusy(true);
    setError(null);
    const path = connect ? "connect" : "disconnect";
    const response = await fetch(
      `/api/connectors/${tenantSlug}/mcp/${status.serverId}/${path}`,
      { credentials: "include", method: "POST" }
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Unable to update MCP connection.");
      setIsBusy(false);
      return;
    }
    setStatus((current) => ({ ...current, connected: connect }));
    toast.success(
      connect ? "MCP server connected." : "MCP server disconnected."
    );
    setIsBusy(false);
  }

  const subtitle = description.trim();

  return (
    <ConnectorCard
      action={
        <ConnectorConnectAction
          connectBusy={isBusy}
          connectDisabled={!status.serverConfigured}
          connected={status.connected}
          disconnectBusy={isBusy}
          itemLabel={name}
          onChat={() => {
            openConnectorChat({
              kind: "mcp",
              name,
              serverId: status.serverId,
            });
          }}
          onConnect={() => {
            void toggleConnection(true);
          }}
          onDisconnect={() => {
            void toggleConnection(false);
          }}
        />
      }
      error={error}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <AdminListItemLogoFrame className="text-muted-foreground">
          <McpIcon className="size-full max-h-6 max-w-6" />
        </AdminListItemLogoFrame>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-medium text-sm">{name}</h2>
          {subtitle ? (
            <p className="truncate text-[13px] text-muted-foreground leading-snug">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </ConnectorCard>
  );
}
