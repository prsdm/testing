import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatLlmProviderErrorMessage } from "./test-llm-connection";

describe("formatLlmProviderErrorMessage", () => {
  it("extracts OpenAI nested error message from JSON", () => {
    const body = JSON.stringify({
      error: {
        code: "invalid_api_key",
        message:
          "Incorrect API key provided: sk-proj-lxvW. You can find your API key at https://platform.openai.com/account/api-keys.",
        type: "invalid_request_error",
      },
    });

    assert.equal(
      formatLlmProviderErrorMessage(body, "fallback"),
      "Invalid API key. Update it in Admin → Models."
    );
  });

  it("returns plain text bodies unchanged", () => {
    assert.equal(
      formatLlmProviderErrorMessage("Unauthorized", "fallback"),
      "Unauthorized"
    );
  });

  it("uses fallback for empty bodies", () => {
    assert.equal(formatLlmProviderErrorMessage("   ", "fallback"), "fallback");
  });
});
