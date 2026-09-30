import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAllowedChatModelId,
  isDeprecatedModelId,
  resolveCanonicalModelId,
} from "./model-id-migrations";

describe("model id migrations", () => {
  it("detects deprecated model ids", () => {
    assert.equal(isDeprecatedModelId("openai/gpt-5.4-2026-03-05"), true);
    assert.equal(isDeprecatedModelId("openai/gpt-5.4"), false);
  });

  it("resolves deprecated ids to canonical catalog ids", () => {
    assert.equal(
      resolveCanonicalModelId("openai/gpt-5.4-2026-03-05"),
      "openai/gpt-5.4"
    );
    assert.equal(
      resolveCanonicalModelId("anthropic/claude-sonnet-4-6"),
      "anthropic/claude-sonnet-5"
    );
    assert.equal(
      resolveCanonicalModelId("openai/gpt-5.4-nano-2026-03-17"),
      "openai/gpt-5.4"
    );
  });

  it("leaves canonical ids unchanged", () => {
    assert.equal(resolveCanonicalModelId("openai/gpt-4o"), "openai/gpt-4o");
  });

  it("allows deprecated ids when they map to the catalog", () => {
    assert.equal(isAllowedChatModelId("openai/gpt-5.4-2026-03-05"), true);
    assert.equal(isAllowedChatModelId("openai/unknown-model"), false);
  });
});
