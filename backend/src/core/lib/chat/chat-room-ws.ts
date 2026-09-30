import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { subscribeChatRoom } from "@/core/lib/chat/chat-room-bus";
import { authorizeChatRoomSubscription } from "@/core/lib/chat/chat-room-subscription";
import {
  clearAllChatRoomTypingForUser,
  clearChatRoomTyping,
  setChatRoomTyping,
} from "@/core/lib/chat/chat-room-typing";
import { runWithIncomingMessage } from "@/load-request-context";
import { isUuid } from "@/shared/utils";

const HEARTBEAT_MS = 25_000;

const CHAT_ROOM_WS_PATH = /^\/api\/chat\/([^/]+)\/ws\/?$/;

function chatRoomWebSocketPath(pathname: string): string | null {
  const match = CHAT_ROOM_WS_PATH.exec(pathname);
  return match?.[1] ?? null;
}

type ClientTypingMessage =
  | {
      type: "typing.start";
      threadRootMessageId?: string | null;
    }
  | { type: "typing.stop" };

function parseClientMessage(raw: unknown): ClientTypingMessage | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const type = (raw as { type?: unknown }).type;
  if (type === "typing.stop") {
    return { type: "typing.stop" };
  }
  if (type === "typing.start") {
    const threadRootMessageId = (raw as { threadRootMessageId?: unknown })
      .threadRootMessageId;
    if (
      threadRootMessageId !== undefined &&
      threadRootMessageId !== null &&
      !isUuid(String(threadRootMessageId))
    ) {
      return null;
    }
    return {
      threadRootMessageId:
        threadRootMessageId === undefined || threadRootMessageId === null
          ? null
          : String(threadRootMessageId),
      type: "typing.start",
    };
  }
  return null;
}

async function handleChatRoomSocket(
  ws: WebSocket,
  req: IncomingMessage,
  chatId: string
) {
  await runWithIncomingMessage(req, async () => {
    const access = await authorizeChatRoomSubscription(chatId);
    if (!access.ok) {
      ws.close(access.closeCode, access.reason);
      return;
    }

    ws.send(JSON.stringify({ chatId: access.chatId, type: "connected" }));

    const unsubscribe = subscribeChatRoom(access.chatId, (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    });

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, HEARTBEAT_MS);

    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
      clearAllChatRoomTypingForUser({
        chatId: access.chatId,
        userId: access.authUserId,
      });
    };

    ws.on("message", (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        return;
      }
      const message = parseClientMessage(parsed);
      if (!message) {
        return;
      }
      if (message.type === "typing.stop") {
        clearChatRoomTyping({
          chatId: access.chatId,
          userId: access.authUserId,
        });
        return;
      }
      setChatRoomTyping({
        chatId: access.chatId,
        displayName: access.displayName,
        threadRootMessageId: message.threadRootMessageId,
        userId: access.authUserId,
      });
    });

    ws.on("close", close);
    ws.on("error", close);
  });
}

export function attachChatRoomWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const host = req.headers.host ?? "127.0.0.1";
    const pathname = new URL(req.url ?? "/", `http://${host}`).pathname;
    const chatId = chatRoomWebSocketPath(pathname);
    if (!chatId) {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleChatRoomSocket(ws, req, chatId);
    });
  });
}
