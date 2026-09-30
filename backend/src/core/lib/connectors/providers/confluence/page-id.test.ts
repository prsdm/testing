import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConfluencePageId } from "./page-id";

describe("confluence page id", () => {
  it("accepts numeric page ids", () => {
    assert.equal(parseConfluencePageId("123456789"), "123456789");
  });

  it("extracts ids from confluence urls", () => {
    assert.equal(
      parseConfluencePageId(
        "https://acme.atlassian.net/wiki/spaces/ENG/pages/123456789/Release+notes"
      ),
      "123456789"
    );
  });
});
