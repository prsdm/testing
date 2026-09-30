import {
  convertToModelMessages,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { chatModels } from "@/shared/ai/models";

function modelProvider(modelId: string) {
  return chatModels.find((model) => model.id === modelId)?.provider ?? "openai";
}

function isOpenAiNativeReasoningPart(part: {
  type: string;
  providerOptions?: unknown;
}): boolean {
  if (part.type !== "reasoning" && part.type !== "reasoning-file") {
    return false;
  }
  if (!part.providerOptions || typeof part.providerOptions !== "object") {
    return false;
  }
  const openai = (part.providerOptions as { openai?: unknown }).openai;
  if (!openai || typeof openai !== "object") {
    return false;
  }
  const record = openai as {
    itemId?: unknown;
    reasoningEncryptedContent?: unknown;
  };
  return Boolean(record.itemId ?? record.reasoningEncryptedContent);
}

/**
 * Strip generic `{ type: "reasoning", text }` UI parts before OpenAI replay.
 * Keep provider-native reasoning items — OpenAI Responses requires msg_/rs_ pairs.
 */
export function stripGenericReasoningForOpenAi(
  messages: ModelMessage[]
): ModelMessage[] {
  return messages
    .map((message) => {
      if (message.role !== "assistant" || typeof message.content === "string") {
        return message;
      }
      return {
        ...message,
        content: message.content.filter((part) => {
          if (part.type !== "reasoning" && part.type !== "reasoning-file") {
            return true;
          }
          return isOpenAiNativeReasoningPart(part);
        }),
      };
    })
    .filter((message) => {
      if (typeof message.content === "string") {
        return message.content.trim().length > 0;
      }
      return message.content.length > 0;
    });
}

/** Prepare client UI history for model replay. Never mutate streamText step messages. */
export function pruneModelMessagesForProvider(args: {
  messages: ModelMessage[];
  modelId: string;
}): ModelMessage[] {
  if (modelProvider(args.modelId) !== "openai") {
    return args.messages;
  }
  return stripGenericReasoningForOpenAi(args.messages);
}

/** Drop provider-bound and incomplete parts that cannot be safely replayed. */
export function prepareChatUiMessagesForModelReplay(args: {
  uiMessages: UIMessage[];
  continuationAssistantMessageId?: string;
}): UIMessage[] {
  return args.uiMessages.map((message) => {
    if (message.role !== "assistant") {
      return message;
    }

    const metadata =
      message.metadata && typeof message.metadata === "object"
        ? (message.metadata as { workflowRunStatus?: string })
        : undefined;
    const shouldStripReasoning =
      message.id === args.continuationAssistantMessageId ||
      metadata?.workflowRunStatus === "cancelled" ||
      metadata?.workflowRunStatus === "failed";

    if (!shouldStripReasoning) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.filter((part) => {
        if (part.type === "reasoning" || part.type === "reasoning-file") {
          return false;
        }
        if (
          part.type.startsWith("tool-") &&
          "state" in part &&
          (part.state === "input-streaming" || part.state === "input-available")
        ) {
          return false;
        }
        return true;
      }),
    };
  });
}

export async function convertChatUiMessagesForModel(args: {
  uiMessages: UIMessage[];
  modelId: string;
  tools?: ToolSet;
  continuationAssistantMessageId?: string;
}): Promise<ModelMessage[]> {
  const preparedUiMessages = prepareChatUiMessagesForModelReplay({
    continuationAssistantMessageId: args.continuationAssistantMessageId,
    uiMessages: args.uiMessages,
  });
  const modelMessages = await convertToModelMessages(preparedUiMessages, {
    ignoreIncompleteToolCalls: false,
    ...(args.tools ? { tools: args.tools } : {}),
  });
  return pruneModelMessagesForProvider({
    messages: modelMessages,
    modelId: args.modelId,
  });
}
