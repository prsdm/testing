import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNotionDatabaseCreateBody } from "./database-create-body";

describe("notion database create body", () => {
  it("uses workspace parent and initial_data_source schema", () => {
    const body = buildNotionDatabaseCreateBody({
      parent: { type: "workspace" },
      properties: { Name: { title: {} } },
      title: "Tracker",
    });
    assert.deepEqual(body.parent, { type: "workspace", workspace: true });
    assert.deepEqual(body.initial_data_source, {
      properties: { Name: { title: {} } },
    });
  });

  it("uses page parent when provided", () => {
    const body = buildNotionDatabaseCreateBody({
      parent: { pageId: "abc-123", type: "page" },
      properties: { Name: { title: {} } },
      title: "Tracker",
    });
    assert.deepEqual(body.parent, {
      page_id: "abc-123",
      type: "page_id",
    });
  });
});
