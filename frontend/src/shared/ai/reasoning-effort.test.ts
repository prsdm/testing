import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProviderReasoningOptions,
  effortLevelsForModel,
  formatModelSelectorLabel,
  normalizeReasoningEffortForModel,
  parseModelReasoningPreferences,
  resolveEffortForModelPreferences,
  resolveReasoningEffortFromRequest,
  serializeModelReasoningPreferences,
  withModelReasoningPreference,
} from "./reasoning-effort";

describe("reasoning effort", () => {
  it("resolves legacy reasoningEnabled flag", () => {
    assert.equal(
      resolveReasoningEffortFromRequest({ reasoningEnabled: true }),
      "medium"
    );
    assert.equal(
      resolveReasoningEffortFromRequest({ reasoningEnabled: false }),
      "off"
    );
    assert.equal(
      resolveReasoningEffortFromRequest({
        reasoningEffort: "high",
        reasoningEnabled: false,
      }),
      "high"
    );
  });

  it("limits effort levels by model", () => {
    assert.deepEqual(effortLevelsForModel("openai/gpt-5.4", true), [
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    assert.deepEqual(effortLevelsForModel("openai/gpt-5.6-luna", true), [
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    assert.deepEqual(effortLevelsForModel("anthropic/claude-sonnet-5", true), [
      "low",
      "medium",
      "high",
    ]);
    assert.deepEqual(effortLevelsForModel("openai/gpt-4o", false), []);
  });

  it("formats model selector labels", () => {
    assert.equal(
      formatModelSelectorLabel("GPT-5.4", "medium", true),
      "GPT-5.4 · Medium"
    );
    assert.equal(formatModelSelectorLabel("GPT-4o", "off", false), "GPT-4o");
  });

  it("normalizes unsupported effort for model", () => {
    assert.equal(
      normalizeReasoningEffortForModel({
        effort: "xhigh",
        modelId: "anthropic/claude-sonnet-5",
        supportsReasoning: true,
      }),
      "medium"
    );
    assert.equal(
      normalizeReasoningEffortForModel({
        effort: "high",
        modelId: "openai/gpt-4o",
        supportsReasoning: false,
      }),
      "off"
    );
  });

  it("maps reasoning effort to provider options", () => {
    assert.deepEqual(
      buildProviderReasoningOptions({
        effort: "high",
        modelId: "openai/gpt-5.4",
        provider: "openai",
      }),
      {
        openai: {
          parallelToolCalls: true,
          reasoningEffort: "high",
          reasoningSummary: "auto",
        },
      }
    );

    assert.deepEqual(
      buildProviderReasoningOptions({
        effort: "medium",
        modelId: "anthropic/claude-sonnet-5",
        provider: "anthropic",
      }),
      {
        anthropic: {
          effort: "medium",
          sendReasoning: true,
          thinking: {
            display: "summarized",
            type: "adaptive",
          },
        },
      }
    );

    assert.deepEqual(
      buildProviderReasoningOptions({
        effort: "high",
        modelId: "google/gemini-3.1-pro-preview",
        provider: "google",
      }),
      {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingLevel: "high",
          },
        },
      }
    );
  });

  it("persists reasoning effort per model", () => {
    const preferences = withModelReasoningPreference(
      {},
      "anthropic/claude-sonnet-5",
      "low",
      true
    );

    assert.deepEqual(preferences, {
      "anthropic/claude-sonnet-5": "low",
    });

    assert.equal(
      resolveEffortForModelPreferences(
        preferences,
        "anthropic/claude-sonnet-5",
        true
      ),
      "low"
    );
    assert.equal(
      resolveEffortForModelPreferences(preferences, "openai/gpt-5.4", true),
      "off"
    );

    const serialized = serializeModelReasoningPreferences(preferences);
    assert.deepEqual(parseModelReasoningPreferences(serialized), preferences);
  });
});
