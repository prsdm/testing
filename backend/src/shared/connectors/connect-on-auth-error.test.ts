import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  connectUrlIfAuthError,
  isConnectorAuthErrorMessage,
} from "./connect-on-auth-error";

describe("connection auth error detection", () => {
  it("detects missing credential and 401 responses", () => {
    assert.equal(
      isConnectorAuthErrorMessage("Notion credential not found."),
      true
    );
    assert.equal(
      isConnectorAuthErrorMessage(
        'Notion API /search failed (401): {"object":"error"}'
      ),
      true
    );
  });

  it("ignores validation and API usage errors", () => {
    assert.equal(
      isConnectorAuthErrorMessage("databaseId or databaseTitle is required."),
      false
    );
    assert.equal(
      isConnectorAuthErrorMessage(
        'Notion API /search failed (400): body.filter.value should be "data_source"'
      ),
      false
    );
  });

  it("returns connectUrl only for auth errors", () => {
    assert.deepEqual(
      connectUrlIfAuthError({
        error: new Error("Notion access token missing."),
      }),
      { connectUrl: "/connectors" }
    );
    assert.deepEqual(
      connectUrlIfAuthError({
        error: new Error("databaseId or databaseTitle is required."),
      }),
      {}
    );
  });
});
