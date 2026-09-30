import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelMessage, UIMessage } from "ai";
import {
  convertChatUiMessagesForModel,
  prepareChatUiMessagesForModelReplay,
  stripGenericReasoningForOpenAi,
} from "./convert-chat-ui-messages";

describe("convert-chat-ui-messages", () => {
  it("strips generic reasoning parts for OpenAI UI replay", async () => {
    const uiMessages: UIMessage[] = [
      {
        id: "assistant-1",
        parts: [
          { state: "done", text: "Planning the upload.", type: "reasoning" },
          { text: "I'll create the file.", type: "text" },
        ],
        role: "assistant",
      },
      {
        id: "user-2",
        parts: [{ text: "Thanks", type: "text" }],
        role: "user",
      },
    ];

    const modelMessages = await convertChatUiMessagesForModel({
      modelId: "openai/gpt-5.6-luna",
      uiMessages,
    });

    assert.equal(
      modelMessages.some(
        (message) =>
          message.role === "assistant" &&
          Array.isArray(message.content) &&
          message.content.some(
            (part) =>
              typeof part === "object" &&
              part !== null &&
              "type" in part &&
              part.type === "reasoning"
          )
      ),
      false
    );
    assert.equal(
      modelMessages.some(
        (message) => message.role === "assistant" && message.content !== ""
      ),
      true
    );
  });

  it("keeps OpenAI-native reasoning items paired with assistant messages", () => {
    const messages: ModelMessage[] = [
      {
        content: [
          {
            providerOptions: {
              openai: {
                itemId: "rs_test123",
                reasoningEncryptedContent: "enc",
              },
            },
            text: "Checking knowledge base files.",
            type: "reasoning",
          },
          { text: "Searching the knowledge base.", type: "text" },
        ],
        role: "assistant",
      },
    ];

    const pruned = stripGenericReasoningForOpenAi(messages);

    assert.equal(pruned.length, 1);
    assert.equal(
      Array.isArray(pruned[0]?.content) &&
        pruned[0].content.some((part) => part.type === "reasoning"),
      true
    );
  });

  it("does not strip reasoning for Anthropic models", async () => {
    const uiMessages: UIMessage[] = [
      {
        id: "assistant-1",
        parts: [
          { state: "done", text: "Checking Drive access.", type: "reasoning" },
          { text: "Creating the file.", type: "text" },
        ],
        role: "assistant",
      },
    ];

    const modelMessages = await convertChatUiMessagesForModel({
      modelId: "anthropic/claude-opus-4-8",
      uiMessages,
    });

    assert.equal(
      modelMessages.some(
        (message) =>
          message.role === "assistant" &&
          Array.isArray(message.content) &&
          message.content.some(
            (part) =>
              typeof part === "object" &&
              part !== null &&
              "type" in part &&
              part.type === "reasoning"
          )
      ),
      true
    );
  });

  it("strips native reasoning from cancelled assistant turns before OpenAI replay", async () => {
    const uiMessages: UIMessage[] = [
      {
        id: "assistant-1",
        metadata: { workflowRunStatus: "cancelled" },
        parts: [
          {
            providerOptions: {
              openai: {
                itemId: "rs_cancelled",
                reasoningEncryptedContent: "enc",
              },
            },
            state: "done",
            text: "Planning next step.",
            type: "reasoning",
          },
          {
            input: { query: "report" },
            output: { documents: [] },
            state: "output-available",
            toolCallId: "search-1",
            type: "tool-sourceSearch",
          },
          {
            input: { query: "Finance" },
            state: "input-available",
            toolCallId: "search-2",
            type: "tool-driveSearchFiles",
          },
        ],
        role: "assistant",
      },
    ];

    const modelMessages = await convertChatUiMessagesForModel({
      modelId: "openai/gpt-5.6-luna",
      uiMessages,
    });

    assert.equal(
      modelMessages.some(
        (message) =>
          message.role === "assistant" &&
          Array.isArray(message.content) &&
          message.content.some(
            (part) =>
              typeof part === "object" &&
              part !== null &&
              "type" in part &&
              part.type === "reasoning"
          )
      ),
      false
    );
    assert.equal(
      modelMessages.some(
        (message) =>
          message.role === "assistant" &&
          Array.isArray(message.content) &&
          message.content.some(
            (part) =>
              typeof part === "object" &&
              part !== null &&
              "toolCallId" in part &&
              part.toolCallId === "search-2"
          )
      ),
      false
    );
  });

  it("strips reasoning from the continuation assistant message", () => {
    const prepared = prepareChatUiMessagesForModelReplay({
      continuationAssistantMessageId: "assistant-2",
      uiMessages: [
        {
          id: "assistant-1",
          metadata: { workflowRunStatus: "success" },
          parts: [
            { state: "done", text: "Done.", type: "reasoning" },
            { text: "Finished earlier turn.", type: "text" },
          ],
          role: "assistant",
        },
        {
          id: "assistant-2",
          parts: [
            {
              providerOptions: {
                openai: {
                  itemId: "rs_partial",
                  reasoningEncryptedContent: "enc",
                },
              },
              state: "done",
              text: "Partial reasoning.",
              type: "reasoning",
            },
            {
              input: { query: "report" },
              output: { documents: [] },
              state: "output-available",
              toolCallId: "search-1",
              type: "tool-sourceSearch",
            },
          ],
          role: "assistant",
        },
      ],
    });

    assert.equal(
      prepared[0]?.parts.some((part) => part.type === "reasoning"),
      true
    );
    assert.equal(
      prepared[1]?.parts.some((part) => part.type === "reasoning"),
      false
    );
  });
});
