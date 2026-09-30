import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoomMentionTargets,
  filterRoomMentionTargets,
  insertRoomMention,
  parseActiveRoomMention,
  roomMentionHandleSet,
  splitTextForComposerMentionHighlight,
} from "./room-mention-autocomplete";

describe("parseActiveRoomMention", () => {
  it("detects partial mention at cursor", () => {
    const value = "hey @kim";
    assert.deepEqual(parseActiveRoomMention(value, value.length), {
      at: 4,
      end: 8,
      query: "kim",
    });
  });

  it("ignores @ inside words", () => {
    assert.equal(parseActiveRoomMention("foo@bar", 7), null);
  });
});

describe("insertRoomMention", () => {
  it("replaces the active token with a completed mention", () => {
    const mention = { at: 4, end: 8, query: "kim" };
    const result = insertRoomMention({
      handle: "kimiro",
      mention,
      value: "hey @kim",
    });
    assert.equal(result.nextValue, "hey @kimiro ");
    assert.equal(result.cursor, 12);
  });
});

describe("buildRoomMentionTargets", () => {
  it("includes Kimiro and members", () => {
    const targets = buildRoomMentionTargets({
      members: [
        {
          displayName: "Shubham Pawar",
          email: "shubham@example.com",
          userId: "u2",
        },
      ],
      sessionUserId: "u1",
    });
    assert.equal(targets[0]?.kind, "agent");
    assert.equal(targets[1]?.kind, "member");
    assert.equal((targets[1] as { handle: string }).handle, "Shubham");
  });
});

describe("splitTextForComposerMentionHighlight", () => {
  it("does not highlight the mention token while it is being typed", () => {
    const targets = buildRoomMentionTargets({
      members: [
        {
          displayName: "Shubham Pawar",
          email: "shubham@example.com",
          userId: "u2",
        },
      ],
    });
    const handles = roomMentionHandleSet(targets);
    const value = "hey @Shub";
    const segments = splitTextForComposerMentionHighlight({
      cursor: value.length,
      handles,
      text: value,
    });
    assert.equal(
      segments.some((segment) => segment.kind === "mention"),
      false
    );
  });

  it("highlights a completed handle after menu selection", () => {
    const targets = buildRoomMentionTargets({
      members: [
        {
          displayName: "Shubham Pawar",
          email: "shubham@example.com",
          userId: "u2",
        },
      ],
    });
    const handles = roomMentionHandleSet(targets);
    const value = "hey @Shubham ";
    const segments = splitTextForComposerMentionHighlight({
      cursor: value.length,
      handles,
      text: value,
    });
    assert.deepEqual(segments, [
      { kind: "text", value: "hey " },
      { kind: "mention", value: "@Shubham" },
      { kind: "text", value: " " },
    ]);
  });
});

describe("filterRoomMentionTargets", () => {
  it("matches agent and members by prefix", () => {
    const targets = buildRoomMentionTargets({
      members: [
        {
          displayName: "Prasad M",
          email: "prasad@example.com",
          userId: "u1",
        },
      ],
    });
    assert.equal(
      filterRoomMentionTargets(targets, "kim").some((t) => t.kind === "agent"),
      true
    );
    assert.equal(
      filterRoomMentionTargets(targets, "pra").some((t) => t.kind === "member"),
      true
    );
  });
});
