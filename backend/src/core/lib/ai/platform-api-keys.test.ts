import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getPlatformLlmApiKey,
  getPlatformSerperApiKey,
} from "./platform-api-keys";

const ENV_KEYS = [
  "KIMIRO_MANAGED_OPENAI_API_KEY",
  "OPENAI_API_KEY",
  "KIMIRO_MANAGED_ANTHROPIC_API_KEY",
  "ANTHROPIC_API_KEY",
  "KIMIRO_MANAGED_GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_API_KEY",
  "KIMIRO_MANAGED_SERPER_API_KEY",
  "SERPER_API_KEY",
  "SERPER_KEY",
] as const;

const saved = new Map<string, string | undefined>();

function clearEnv() {
  for (const key of ENV_KEYS) {
    if (!saved.has(key)) {
      saved.set(key, process.env[key]);
    }
    delete process.env[key];
  }
}

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  saved.clear();
});

describe("platform-api-keys", () => {
  it("reads plain and managed LLM env aliases", () => {
    clearEnv();
    process.env.OPENAI_API_KEY = "openai-plain";
    process.env.ANTHROPIC_API_KEY = "anthropic-plain";
    process.env.GOOGLE_API_KEY = "google-plain";
    assert.equal(getPlatformLlmApiKey("openai"), "openai-plain");
    assert.equal(getPlatformLlmApiKey("anthropic"), "anthropic-plain");
    assert.equal(getPlatformLlmApiKey("google"), "google-plain");
  });

  it("prefers KIMIRO_MANAGED_* over plain env names", () => {
    clearEnv();
    process.env.OPENAI_API_KEY = "openai-plain";
    process.env.KIMIRO_MANAGED_OPENAI_API_KEY = "openai-managed";
    assert.equal(getPlatformLlmApiKey("openai"), "openai-managed");
  });

  it("reads Serper aliases including SERPER_KEY", () => {
    clearEnv();
    process.env.SERPER_KEY = "serper-legacy";
    assert.equal(getPlatformSerperApiKey(), "serper-legacy");
    process.env.SERPER_API_KEY = "serper-standard";
    assert.equal(getPlatformSerperApiKey(), "serper-standard");
  });
});
