import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLlmProviderErrorMessage,
  formatModelErrorMessage,
  isChatRequestCancelledError,
  parseModelErrorFromText,
  parseModelErrorPresentation,
} from "./format-model-error-message";

describe("format-model-error-message", () => {
  it("formats openai insufficient quota stream errors", () => {
    const payload = {
      error: {
        code: "insufficient_quota",
        message:
          "You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.",
        param: null,
        type: "insufficient_quota",
      },
      sequence_number: 2,
      type: "error",
    };

    assert.deepEqual(parseModelErrorPresentation(payload), {
      code: "insufficient_quota",
      docsUrl:
        "https://platform.openai.com/docs/guides/error-codes/api-errors.",
      message: "Exceeded your current quota for this provider.",
      title: "Quota exceeded",
    });
    assert.equal(
      formatModelErrorMessage(payload),
      "Exceeded your current quota for this provider."
    );
  });

  it("formats anthropic quota exceeded errors", () => {
    const payload = {
      error: {
        message:
          "You exceeded your current quota, please check your plan and billing details.",
        type: "quota_exceeded",
      },
      type: "error",
    };

    assert.equal(
      formatModelErrorMessage(payload),
      "Exceeded your current quota for this provider."
    );
  });

  it("formats anthropic low credit balance errors", () => {
    const payload = {
      error: {
        message:
          "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
        type: "invalid_request_error",
      },
      type: "error",
    };

    assert.equal(
      formatModelErrorMessage(payload),
      "Exceeded your current quota for this provider."
    );

    const apiCallError = {
      data: payload,
      message:
        "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
      name: "AI_APICallError",
      responseBody: JSON.stringify(payload),
    };

    assert.equal(
      formatModelErrorMessage(apiCallError),
      "Exceeded your current quota for this provider."
    );
  });

  it("formats google resource exhausted errors", () => {
    const payload = {
      error: {
        code: 429,
        message:
          "You exceeded your current quota, please check your plan and billing details.",
        status: "RESOURCE_EXHAUSTED",
      },
    };

    assert.equal(
      formatModelErrorMessage(payload),
      "Exceeded your current quota for this provider."
    );
  });

  it("parses nested openai api error json bodies", () => {
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

  it("parses persisted assistant error text", () => {
    const text = JSON.stringify({
      error: {
        code: "rate_limit_exceeded",
        message: "Rate limit reached for requests",
      },
      type: "error",
    });

    const parsed = parseModelErrorFromText(text);
    assert.equal(parsed?.title, "Rate limit reached");
    assert.match(parsed?.message ?? "", /wait a moment/i);
  });

  it("does not treat normal assistant replies as model errors", () => {
    assert.equal(
      parseModelErrorFromText(
        "Done! Your message 'can you review somthing for me?' has been sent to Prasad."
      ),
      null
    );
    assert.equal(
      parseModelErrorFromText(
        "You're welcome! Let me know if you need anything else."
      ),
      null
    );
  });

  it("parses formatted model error lines saved in chat history", () => {
    assert.equal(
      parseModelErrorFromText("Exceeded your current quota for this provider.")
        ?.message,
      "Exceeded your current quota for this provider."
    );
    assert.equal(
      parseModelErrorFromText("Model request failed")?.title,
      "Model request failed"
    );
  });

  it("uses fallback for empty bodies", () => {
    assert.equal(formatLlmProviderErrorMessage("   ", "fallback"), "fallback");
  });

  it("detects user-cancelled chat stream errors", () => {
    assert.equal(
      isChatRequestCancelledError(new DOMException("Aborted", "AbortError")),
      true
    );
    assert.equal(
      isChatRequestCancelledError(new Error("Request was aborted")),
      true
    );
    assert.equal(isChatRequestCancelledError({ isAborted: true }), true);
    assert.equal(
      isChatRequestCancelledError(new Error("Rate limit reached")),
      false
    );
  });
});
