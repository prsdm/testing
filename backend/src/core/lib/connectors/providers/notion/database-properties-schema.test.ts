import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultDatabasePropertiesSchema,
  resolveDatabasePropertiesSchema,
} from "./database-properties-schema";

describe("notion database properties schema", () => {
  it("defaults to Name and Status columns", () => {
    const schema = defaultDatabasePropertiesSchema();
    assert.deepEqual(schema, {
      Name: { title: {} },
      Status: { status: {} },
    });
  });

  it("accepts a custom schema with a title column", () => {
    const schema = resolveDatabasePropertiesSchema(
      '{"Task":{"title":{}},"Priority":{"select":{"options":[]}}}'
    );
    assert.ok("Task" in schema);
  });
});
