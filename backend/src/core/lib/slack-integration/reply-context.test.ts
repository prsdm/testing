import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveSlackAgentReplyContext,
  resolveSlackReplyContext,
} from "./reply-context";

describe("resolveSlackReplyContext", () => {
  it("uses channel-level replies for top-level mentions", () => {
    assert.deepEqual(
      resolveSlackReplyContext({ thread_ts: undefined, ts: "100.1" }),
      {
        conversationKey: "100.1",
        messageTs: "100.1",
        replyThreadTs: null,
      }
    );
  });

  it("threads replies when the mention is inside a thread", () => {
    assert.deepEqual(
      resolveSlackReplyContext({ thread_ts: "100.0", ts: "100.2" }),
      {
        conversationKey: "100.0",
        messageTs: "100.2",
        replyThreadTs: "100.0",
      }
    );
  });
});

describe("resolveSlackAgentReplyContext", () => {
  it("always replies inside the agent thread", () => {
    assert.deepEqual(
      resolveSlackAgentReplyContext({ thread_ts: "200.0", ts: "200.1" }),
      {
        conversationKey: "200.0",
        messageTs: "200.1",
        replyThreadTs: "200.0",
      }
    );
  });
});
