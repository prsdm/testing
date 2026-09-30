import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  serializeNotionPageProperties,
  toNotionUserLookup,
} from "./serialize-page-properties";

describe("serialize notion page properties", () => {
  it("serializes status, assignee, and select fields", () => {
    const text = serializeNotionPageProperties({
      Assignee: {
        people: [{ name: "prsdm" }],
        type: "people",
      },
      Name: { title: [{ plain_text: "chat UI bug" }], type: "title" },
      Priority: { select: { name: "High" }, type: "select" },
      Status: { status: { name: "In progress" }, type: "status" },
    });
    assert.match(text, /Status: In progress/);
    assert.match(text, /Assignee: prsdm/);
    assert.match(text, /Priority: High/);
    assert.doesNotMatch(text, /Name:/);
  });

  it("resolves assignee user ids via workspace user lookup", () => {
    const userById = toNotionUserLookup([
      { email: "prsdm@example.com", id: "user-uuid-1", name: "prsdm" },
    ]);
    const text = serializeNotionPageProperties(
      {
        Assignee: {
          people: [{ id: "user-uuid-1", object: "user" }],
          type: "people",
        },
      },
      userById
    );
    assert.match(text, /Assignee: prsdm \(prsdm@example\.com\)/);
  });
});
