import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterMultiplayerMainTimelineMessages,
  isAssistantMessageStreamingForViewer,
  isInProgressRoomAssistantPlaceholder,
  shouldShowPendingAssistantThinking,
} from "@/lib/chat/room-message-visibility";
import { markWorkflowRunStopped } from "@/lib/chat/stopped-workflow-runs";
import type { ChatMessage } from "@/shared/types";

describe("room message visibility", () => {
  it("hides empty in-progress assistant placeholders", () => {
    const message: ChatMessage = {
      id: "a1",
      parts: [{ text: "", type: "text" }],
      role: "assistant",
      metadata: { workflowRunStatus: "running" },
    };
    assert.equal(isInProgressRoomAssistantPlaceholder(message), true);
    assert.deepEqual(filterMultiplayerMainTimelineMessages([message]), []);
  });

  it("does not stream stale running metadata after local stop", () => {
    markWorkflowRunStopped("chat-1", "run-1");
    const message: ChatMessage = {
      id: "a1",
      parts: [{ text: "Partial", type: "text" }],
      role: "assistant",
      metadata: { workflowRunId: "run-1", workflowRunStatus: "running" },
    };
    assert.equal(
      isAssistantMessageStreamingForViewer({
        awaitingPostDenialContinuation: false,
        chatId: "chat-1",
        isLastVisible: true,
        isMultiplayerRoom: true,
        message,
        status: "ready",
        workflowRunActive: false,
      }),
      false
    );
  });

  it("scopes pending thinking to the active thread run", () => {
    const messages: ChatMessage[] = [
      {
        id: "u1",
        parts: [{ text: "hi", type: "text" }],
        role: "user",
        threadRootMessageId: "root-1",
      },
    ];
    assert.equal(
      shouldShowPendingAssistantThinking({
        activeRunComposerThreadRootMessageId: "root-1",
        messages,
        status: "streaming",
        viewThreadRootMessageId: "root-1",
      }),
      true
    );
    assert.equal(
      shouldShowPendingAssistantThinking({
        activeRunComposerThreadRootMessageId: "root-1",
        messages,
        status: "streaming",
        viewThreadRootMessageId: null,
      }),
      false
    );
    assert.equal(
      shouldShowPendingAssistantThinking({
        activeRunComposerThreadRootMessageId: undefined,
        messages,
        status: "ready",
        viewThreadRootMessageId: "root-1",
      }),
      false
    );
  });

  it("shows in-progress assistant messages with partial text", () => {
    const message: ChatMessage = {
      id: "a1",
      parts: [{ text: "Hello from Kimiro", type: "text" }],
      role: "assistant",
      metadata: { workflowRunStatus: "running" },
    };
    assert.equal(isInProgressRoomAssistantPlaceholder(message), false);
    assert.deepEqual(filterMultiplayerMainTimelineMessages([message]), [
      message,
    ]);
  });
});
