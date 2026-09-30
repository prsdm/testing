"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import type {
  ChatRoomRealtimeEvent,
  ChatRoomTypist,
} from "@/shared/chat/chat-room-events";
import { isUuid } from "@/shared/utils";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15_000;

function chatRoomWebSocketUrl(chatId: string): string {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  if (typeof window === "undefined") {
    return "";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${basePath}/api/chat/${chatId}/ws`;
}

export function useChatRoomEvents(args: {
  chatId: string;
  enabled: boolean;
  messagesApiKey: string | null;
  reactionsApiKey?: string | null;
  onRemoteMessagesChanged?: () => void;
  onMessagesChanged?: () => void;
  /** Refetch persisted messages after the socket reconnects (missed realtime events). */
  onReconnect?: () => void;
}) {
  const { mutate } = useSWRConfig();
  const attemptedHydrationClearRef = useRef(args.onRemoteMessagesChanged);
  const onReconnectRef = useRef(args.onReconnect);
  const [roomTypists, setRoomTypists] = useState<ChatRoomTypist[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  attemptedHydrationClearRef.current = args.onRemoteMessagesChanged;
  onReconnectRef.current = args.onReconnect;

  const sendRoomTypingSignal = useCallback(
    (active: boolean, threadRootMessageId?: string | null) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      if (active) {
        socket.send(
          JSON.stringify({
            threadRootMessageId: threadRootMessageId ?? null,
            type: "typing.start",
          })
        );
        return;
      }
      socket.send(JSON.stringify({ type: "typing.stop" }));
    },
    []
  );

  useEffect(() => {
    if (!(args.enabled && args.messagesApiKey && isUuid(args.chatId))) {
      setRoomTypists([]);
      return;
    }

    let disposed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;
    let hadConnected = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleMessagesChanged = (
      payload: Extract<ChatRoomRealtimeEvent, { type: "messages.changed" }>
    ) => {
      attemptedHydrationClearRef.current?.();
      args.onMessagesChanged?.();

      void mutate(args.messagesApiKey as string);
      if (payload.threadRootMessageId) {
        void mutate(
          `${args.messagesApiKey}&threadRootMessageId=${payload.threadRootMessageId}`
        );
      }
      if (args.reactionsApiKey) {
        void mutate(args.reactionsApiKey);
      }
    };

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }
      clearReconnectTimer();
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** reconnectAttempt,
        RECONNECT_MAX_MS
      );
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (disposed) {
        return;
      }
      clearReconnectTimer();
      socket = new WebSocket(chatRoomWebSocketUrl(args.chatId));
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt = 0;
        if (hadConnected) {
          onReconnectRef.current?.();
        }
        hadConnected = true;
      };

      socket.onmessage = (messageEvent) => {
        let payload: ChatRoomRealtimeEvent;
        try {
          payload = JSON.parse(
            String(messageEvent.data)
          ) as ChatRoomRealtimeEvent;
        } catch {
          return;
        }

        if (payload.type === "typing.changed") {
          setRoomTypists(payload.typists);
          return;
        }

        if (payload.type === "reactions.changed") {
          if (args.reactionsApiKey) {
            void mutate(args.reactionsApiKey);
          }
          return;
        }

        if (payload.type !== "messages.changed") {
          return;
        }

        handleMessagesChanged(payload);
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (!disposed) {
          scheduleReconnect();
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      socket?.close();
      socketRef.current = null;
      setRoomTypists([]);
    };
  }, [
    args.chatId,
    args.enabled,
    args.messagesApiKey,
    args.reactionsApiKey,
    args.onMessagesChanged,
    mutate,
  ]);

  return { roomTypists, sendRoomTypingSignal };
}
