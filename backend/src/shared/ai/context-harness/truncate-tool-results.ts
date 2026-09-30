import type { ModelMessage } from "ai";
import { redactLibraryToolOutputForModel } from "@/shared/ai/redact-library-urls-for-model";
import { MAX_TOOL_RESULT_TOKENS } from "./constants";
import { estimateTokensFromText } from "./token-estimate";
import { truncateContextForLlm } from "./truncate-context-for-llm";

function truncateJsonValue(
  value: unknown,
  maxTokens = MAX_TOOL_RESULT_TOKENS
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return truncateContextForLlm(value, maxTokens);
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => truncateJsonValue(entry, maxTokens));
  }

  const record = { ...(value as Record<string, unknown>) };
  if (typeof record.contextForLlm === "string") {
    record.contextForLlm = truncateContextForLlm(
      record.contextForLlm,
      maxTokens
    );
  }

  const serialized = JSON.stringify(record);
  if (estimateTokensFromText(serialized) <= maxTokens) {
    return record;
  }

  if (typeof record.contextForLlm === "string") {
    record.contextForLlm = truncateContextForLlm(
      record.contextForLlm,
      Math.max(512, Math.floor(maxTokens / 2))
    );
    const retry = JSON.stringify(record);
    if (estimateTokensFromText(retry) <= maxTokens) {
      return record;
    }
  }

  return {
    ...record,
    preview: truncateContextForLlm(serialized, maxTokens),
    truncated: true,
  };
}

function truncateToolResultPart(
  part: Record<string, unknown>,
  maxTokens = MAX_TOOL_RESULT_TOKENS
): Record<string, unknown> {
  if (part.type !== "tool-result" || !("output" in part)) {
    return part;
  }
  const output = part.output;
  if (typeof output !== "object" || output === null || !("value" in output)) {
    return part;
  }
  const typedOutput = output as { type?: string; value?: unknown };
  const toolName =
    typeof part.toolName === "string" ? part.toolName : undefined;
  const redactedValue = redactLibraryToolOutputForModel(
    toolName,
    typedOutput.value
  );
  return {
    ...part,
    output: {
      ...typedOutput,
      value: truncateJsonValue(redactedValue, maxTokens),
    },
  };
}

function truncateMessageContent(
  content: ModelMessage["content"],
  maxTokens = MAX_TOOL_RESULT_TOKENS
): ModelMessage["content"] {
  if (typeof content === "string") {
    return truncateContextForLlm(content, maxTokens);
  }
  if (!Array.isArray(content)) {
    return content;
  }
  return content.map((part) => {
    if (typeof part !== "object" || part === null) {
      return part;
    }
    if ("type" in part && part.type === "tool-result") {
      return truncateToolResultPart(
        part as unknown as Record<string, unknown>,
        maxTokens
      ) as unknown as typeof part;
    }
    return part;
  }) as ModelMessage["content"];
}

/** Shrink tool payloads before they are sent to the model. */
export function truncateToolResultsInModelMessages(
  messages: ModelMessage[],
  maxTokens = MAX_TOOL_RESULT_TOKENS
): ModelMessage[] {
  return messages.map((message) => {
    if (message.role !== "tool" && message.role !== "assistant") {
      return message;
    }
    return {
      ...message,
      content: truncateMessageContent(message.content, maxTokens),
    } as ModelMessage;
  });
}
