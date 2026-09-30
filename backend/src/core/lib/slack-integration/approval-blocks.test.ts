import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSlackIntegrationApprovalBlocks,
  buildSlackIntegrationApprovalResolvedBlocks,
  decodeSlackIntegrationApprovalPayload,
  encodeSlackIntegrationApprovalPayload,
} from "./approval-blocks";

describe("slack bot approval payload", () => {
  it("round-trips encoded payloads", () => {
    const payload = {
      approvalId: "approval-1",
      assistantMessageId: "assistant-1",
      channelId: "C123",
      chatId: "chat-1",
      tenantId: "tenant-1",
      threadTs: "1234.5678",
      workflowRunId: "run-1",
    };
    const encoded = encodeSlackIntegrationApprovalPayload(payload);
    assert.deepEqual(decodeSlackIntegrationApprovalPayload(encoded), payload);
  });

  it("builds card approval blocks with human-readable copy", () => {
    const blocks = buildSlackIntegrationApprovalBlocks({
      payload: {
        approvalId: "approval-1",
        assistantMessageId: "assistant-1",
        channelId: "C123",
        chatId: "chat-1",
        tenantId: "tenant-1",
        threadTs: "1234.5678",
        workflowRunId: "run-1",
      },
      toolArgs: {
        subject: "Weekly update",
        to: "admin@example.com",
      },
      toolName: "gmailSendMessage",
    });

    assert.equal(blocks.length, 2);
    const card = blocks[0] as {
      type?: string;
      title?: { text?: string };
      subtitle?: { text?: string };
      body?: { text?: string };
    };
    assert.equal(card.type, "card");
    assert.match(card.title?.text ?? "", /Sending email admin@example.com/);
    assert.match(card.subtitle?.text ?? "", /Gmail/);
    assert.doesNotMatch(card.title?.text ?? "", /gmailSendMessage/);

    const actions = blocks[1] as {
      type?: string;
      elements?: Array<{ text?: { text?: string } }>;
    };
    assert.equal(actions.type, "actions");
    assert.equal(actions.elements?.[0]?.text?.text, "Approve");
    assert.equal(actions.elements?.[1]?.text?.text, "Deny");
  });

  it("builds resolved approval blocks without action buttons", () => {
    const blocks = buildSlackIntegrationApprovalResolvedBlocks({
      approved: false,
      displayLabel: "Sending email admin@example.com",
    });
    assert.equal(blocks.length, 1);
    const card = blocks[0] as { type?: string; body?: { text?: string } };
    assert.equal(card.type, "card");
    assert.match(card.body?.text ?? "", /was canceled/);
    assert.doesNotMatch(card.body?.text ?? "", /will not run/);
    assert.doesNotMatch(JSON.stringify(blocks), /actions/);
  });
});
