"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { channelsListSwrKey } from "@/lib/channels/channels-api";
import { dmsListSwrKey } from "@/lib/dms/dms-api";

type InboxEvent =
  | { type: "connected"; tenantSlug: string }
  | { type: "unread.changed"; chatId: string };

function workspaceInboxWebSocketUrl(tenantSlug: string): string {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  if (typeof window === "undefined") {
    return "";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${basePath}/api/workspace/${encodeURIComponent(tenantSlug)}/inbox/ws`;
}

export function useWorkspaceInboxEvents(tenantSlug: string | null) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }

    const url = workspaceInboxWebSocketUrl(tenantSlug);
    const socket = new WebSocket(url);

    socket.onmessage = (messageEvent) => {
      let payload: InboxEvent;
      try {
        payload = JSON.parse(String(messageEvent.data)) as InboxEvent;
      } catch {
        return;
      }

      if (payload.type !== "unread.changed") {
        return;
      }

      void mutate(channelsListSwrKey(tenantSlug));
      void mutate(dmsListSwrKey(tenantSlug));
    };

    return () => {
      socket.close();
    };
  }, [mutate, tenantSlug]);
}
