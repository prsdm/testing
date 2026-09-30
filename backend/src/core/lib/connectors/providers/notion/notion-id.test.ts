import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNotionUuid, parseNotionId, slugLikeIdToTitle } from "./notion-id";

describe("notion id", () => {
  it("accepts hyphenated and compact uuids", () => {
    assert.equal(isNotionUuid("6ee911d9-189c-4844-93e8-260c1438b6e4"), true);
    assert.equal(
      parseNotionId("6ee911d9189c484493e8260c1438b6e4"),
      "6ee911d9189c484493e8260c1438b6e4"
    );
  });

  it("rejects placeholder slugs", () => {
    assert.equal(isNotionUuid("chat-ui-bug-id"), false);
    assert.equal(parseNotionId("chat-ui-bug-id"), null);
  });

  it("extracts ids from notion urls", () => {
    assert.equal(
      parseNotionId(
        "https://www.notion.so/Chat-UI-bug-6ee911d9189c484493e8260c1438b6e4"
      ),
      "6ee911d9189c484493e8260c1438b6e4"
    );
  });

  it("converts slug-like ids to title text", () => {
    assert.equal(slugLikeIdToTitle("chat-ui-bug"), "chat ui bug");
  });
});
