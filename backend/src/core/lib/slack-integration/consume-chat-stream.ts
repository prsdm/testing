import type { UIMessage, UIMessageChunk } from "ai";
import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
} from "ai";

function parseChatStreamResponseBody(
  stream: ReadableStream<Uint8Array>
): ReadableStream<UIMessageChunk> {
  return parseJsonEventStream({
    schema: uiMessageChunkSchema,
    stream,
  }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) {
          throw chunk.error;
        }
        controller.enqueue(chunk.value);
      },
    })
  );
}

export async function consumeChatStreamResponse(args: {
  response: Response;
  assistantMessageId: string;
}) {
  if (!args.response.body) {
    throw new Error("Chat stream response had no body.");
  }

  const stream = readUIMessageStream({
    message: {
      id: args.assistantMessageId,
      parts: [],
      role: "assistant",
    },
    stream: parseChatStreamResponseBody(args.response.body),
  });

  let finalMessage: UIMessage | undefined;
  for await (const message of stream) {
    finalMessage = message;
  }
  return finalMessage;
}
