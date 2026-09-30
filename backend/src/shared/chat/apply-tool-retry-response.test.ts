import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConnectorToolRerunToMessages,
  applyOptimisticToolRerunStart,
  applyToolRetryToMessages,
} from "./apply-tool-retry-response";

test("applyToolRetryToMessages resets denied tool and trims suffix text", () => {
  const messages = applyToolRetryToMessages(
    [
      {
        id: "assistant-1",
        metadata: {
          workflowRunStatus: "success",
        },
        parts: [
          {
            input: { name: "reject-chain-test" },
            output: { id: "folder-id" },
            state: "output-available",
            toolCallId: "call-folder",
            type: "tool-driveCreateFolder",
          },
          {
            approval: { approved: false, id: "approval-upload" },
            input: { content: "meeting notes", name: "notes.txt" },
            output: { reason: "Rejected by user", type: "execution-denied" },
            state: "output-denied",
            toolCallId: "call-upload",
            type: "tool-driveUploadFile",
          },
          { text: "Upload was rejected, nothing else happened.", type: "text" },
        ],
        role: "assistant",
      },
    ],
    { assistantMessageId: "assistant-1", toolCallId: "call-upload" }
  );

  const assistant = messages[0];
  assert.equal(assistant?.parts.length, 2);
  const upload = assistant?.parts[1];
  assert.equal(
    upload && "state" in upload ? upload.state : undefined,
    "approval-requested"
  );
  assert.equal(assistant?.metadata?.workflowRunStatus, "suspended");
});

test("applyConnectorToolRerunToMessages replaces a successful tool result", () => {
  const messages = applyConnectorToolRerunToMessages(
    [
      {
        id: "assistant-1",
        metadata: { workflowRunStatus: "success" },
        parts: [
          {
            input: { name: "folder-a" },
            output: { id: "folder-a" },
            state: "output-available",
            toolCallId: "call-folder",
            type: "tool-driveCreateFolder",
          },
          { text: "Created folder A.", type: "text" },
        ],
        role: "assistant",
      },
    ],
    {
      assistantMessageId: "assistant-1",
      nextPart: {
        input: { name: "folder-b" },
        output: { id: "folder-b" },
        state: "output-available",
        toolCallId: "call-folder",
        type: "tool-driveCreateFolder",
      },
      toolCallId: "call-folder",
    }
  );

  const assistant = messages[0];
  assert.equal(assistant?.parts.length, 1);
  assert.equal(
    assistant?.parts[0] && "output" in assistant.parts[0]
      ? (assistant.parts[0].output as { id?: string }).id
      : undefined,
    "folder-b"
  );
  assert.equal(assistant?.metadata?.workflowRunStatus, "running");
});

test("applyConnectorToolRerunToMessages keeps parallel tool peers", () => {
  const messages = applyConnectorToolRerunToMessages(
    [
      {
        id: "assistant-1",
        metadata: { workflowRunStatus: "success" },
        parts: [
          { text: "Searching both sources.", type: "text" },
          {
            input: { query: "deepseek harness" },
            output: { query: "deepseek harness", results: [] },
            state: "output-available",
            toolCallId: "web-1",
            type: "tool-webSearch",
          },
          {
            input: { query: "deepseek harness github" },
            output: { query: "deepseek harness github", results: [] },
            state: "output-available",
            toolCallId: "web-2",
            type: "tool-webSearch",
          },
          { text: "Here is the summary.", type: "text" },
        ],
        role: "assistant",
      },
    ],
    {
      assistantMessageId: "assistant-1",
      nextPart: {
        input: { query: "deepseek harness" },
        output: {
          query: "deepseek harness",
          results: [{ snippet: "", title: "New", url: "https://example.com" }],
        },
        state: "output-available",
        toolCallId: "web-1",
        type: "tool-webSearch",
      },
      toolCallId: "web-1",
    }
  );

  const assistant = messages[0];
  assert.equal(assistant?.parts.length, 3);
  assert.equal(assistant?.parts[0]?.type, "text");
  assert.equal(
    assistant?.parts[2] && "toolCallId" in assistant.parts[2]
      ? assistant.parts[2].toolCallId
      : undefined,
    "web-2"
  );
  assert.equal(
    assistant?.parts.some(
      (part) => part.type === "text" && part.text === "Here is the summary."
    ),
    false
  );
});

test("applyOptimisticToolRerunStart trims suffix and marks tool in-flight", () => {
  const messages = applyOptimisticToolRerunStart(
    [
      {
        id: "assistant-1",
        metadata: { workflowRunStatus: "success" },
        parts: [
          {
            input: { query: "a" },
            output: { query: "a", results: [] },
            state: "output-available",
            toolCallId: "web-1",
            type: "tool-webSearch",
          },
          {
            input: { query: "b" },
            output: { query: "b", results: [] },
            state: "output-available",
            toolCallId: "web-2",
            type: "tool-webSearch",
          },
          { text: "Old answer.", type: "text" },
        ],
        role: "assistant",
      },
    ],
    { assistantMessageId: "assistant-1", toolCallId: "web-1" }
  );

  const assistant = messages[0];
  assert.equal(assistant?.parts.length, 2);
  assert.equal(
    assistant?.parts[0] && "state" in assistant.parts[0]
      ? assistant.parts[0].state
      : undefined,
    "input-available"
  );
  assert.equal(
    assistant?.parts[1] && "toolCallId" in assistant.parts[1]
      ? assistant.parts[1].toolCallId
      : undefined,
    "web-2"
  );
  assert.equal(assistant?.metadata?.workflowRunStatus, "running");
});
