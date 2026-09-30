import type { UIMessageChunk } from "ai";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { ChatMessagePart } from "@/shared/types";

function decodeExecutedToolPartSync(encoded: string): ChatMessagePart[] {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(normalized);
  const parsed = JSON.parse(json);
  return Array.isArray(parsed) ? (parsed as ChatMessagePart[]) : [];
}

/** Resumes incomplete turns via POST /runs continuation, not GET stream reconnect. */
class ChatRunTransport extends DefaultChatTransport<UIMessage> {
  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }
}

export function createChatRunTransport(args: {
  chatId: string;
  onRunHeaders: (headers: {
    runId: string;
    assistantMessageId: string;
    executedToolParts?: ChatMessagePart[];
  }) => void;
}) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  return new ChatRunTransport({
    api: `${basePath}/api/chat/${args.chatId}/runs`,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.includes("application/json")) {
        const payload = (await response.clone().json()) as {
          assistantSkipped?: boolean;
        };
        if (payload.assistantSkipped) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.close();
              },
            }),
            { headers: { "Content-Type": "text/event-stream" }, status: 200 }
          );
        }
      }
      const runId = response.headers.get("x-workflow-run-id");
      const assistantMessageId = response.headers.get("x-assistant-message-id");
      const executedToolSync = response.headers.get("x-executed-tool-sync");
      if (runId && assistantMessageId) {
        args.onRunHeaders({
          assistantMessageId,
          executedToolParts: executedToolSync
            ? decodeExecutedToolPartSync(executedToolSync)
            : undefined,
          runId,
        });
      }
      return response;
    },
    prepareSendMessagesRequest: ({
      messages: requestMessages,
      body,
      trigger,
      messageId,
      api,
    }) => ({
      api,
      body: {
        messages: requestMessages,
        ...body,
        messageId,
        trigger,
      },
    }),
  });
}
