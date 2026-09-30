import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  centsToMicros,
  estimateModelCostUsdMicros,
  estimateUsageCostUsdMicros,
  resolveEffectiveRates,
  resolveModelRatesUsdPerMillion,
  usagePercentUsed,
} from "./usage-cost";

describe("usage-cost", () => {
  it("estimates cheap flash usage below mid-tier", () => {
    const flash = estimateUsageCostUsdMicros({
      inputTokens: 100_000,
      modelId: "google/gemini-3.1-flash-lite",
      outputTokens: 20_000,
      webSearchCount: 0,
    });
    const mid = estimateUsageCostUsdMicros({
      inputTokens: 100_000,
      modelId: "openai/gpt-4o",
      outputTokens: 20_000,
      webSearchCount: 0,
    });
    assert.ok(flash < mid);
  });

  it("adds web search cost", () => {
    const without = estimateUsageCostUsdMicros({
      inputTokens: 0,
      modelId: "openai/gpt-4o-mini",
      outputTokens: 0,
      webSearchCount: 0,
    });
    const withSearch = estimateUsageCostUsdMicros({
      inputTokens: 0,
      modelId: "openai/gpt-4o-mini",
      outputTokens: 0,
      webSearchCount: 5,
    });
    assert.equal(without, 0);
    assert.ok(withSearch > 0);
  });

  it("adds image generation cost by size", () => {
    const square = estimateUsageCostUsdMicros({
      imageGenerations: [{ size: "1024x1024" }],
      inputTokens: 0,
      modelId: "openai/gpt-4o-mini",
      outputTokens: 0,
      webSearchCount: 0,
    });
    const portrait = estimateUsageCostUsdMicros({
      imageGenerations: [{ size: "1024x1536" }],
      inputTokens: 0,
      modelId: "openai/gpt-4o-mini",
      outputTokens: 0,
      webSearchCount: 0,
    });
    assert.ok(square > 0);
    assert.ok(portrait > 0);
    assert.ok(square > portrait);
  });

  it("computes percent used capped at 100", () => {
    assert.equal(
      usagePercentUsed({
        allowanceUsdCents: 1800,
        usedUsdMicros: centsToMicros(900),
      }),
      50
    );
    assert.equal(
      usagePercentUsed({
        allowanceUsdCents: 1800,
        usedUsdMicros: centsToMicros(3000),
      }),
      100
    );
  });

  it("uses official Claude list prices including cache", () => {
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("anthropic/claude-haiku-4-5"),
      { input: 1, output: 5 }
    );
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("anthropic/claude-sonnet-5"),
      { input: 2, output: 10 }
    );
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("anthropic/claude-opus-4-8"),
      { input: 5, output: 25 }
    );
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("anthropic/claude-fable-5"),
      { input: 10, output: 50 }
    );
    const haiku = resolveEffectiveRates({
      modelId: "anthropic/claude-haiku-4-5",
    });
    assert.equal(haiku.cachedInput, 0.1);
    assert.equal(haiku.cacheWrite5m, 1.25);
    assert.equal(haiku.cacheWrite1h, 2);
  });

  it("uses official OpenAI short-context rates", () => {
    assert.deepEqual(resolveModelRatesUsdPerMillion("openai/gpt-5"), {
      input: 1.25,
      output: 10,
    });
    assert.deepEqual(resolveModelRatesUsdPerMillion("openai/gpt-5.2"), {
      input: 1.75,
      output: 14,
    });
    assert.deepEqual(resolveModelRatesUsdPerMillion("openai/gpt-5.4"), {
      input: 2.5,
      output: 15,
    });
    assert.deepEqual(resolveModelRatesUsdPerMillion("openai/gpt-5.5"), {
      input: 5,
      output: 30,
    });
    assert.deepEqual(resolveModelRatesUsdPerMillion("openai/gpt-5.6-luna"), {
      input: 0.2,
      output: 1.2,
    });
  });

  it("uses official Gemini paid-tier rates", () => {
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("google/gemini-3.1-flash-lite"),
      { input: 0.25, output: 1.5 }
    );
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("google/gemini-3.5-flash"),
      { input: 1.5, output: 9 }
    );
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("google/gemini-3-flash-preview"),
      { input: 0.5, output: 3 }
    );
    assert.deepEqual(
      resolveModelRatesUsdPerMillion("google/gemini-3.1-pro-preview"),
      { input: 2, output: 12 }
    );
    const pro = resolveEffectiveRates({
      inputTokens: 250_000,
      modelId: "google/gemini-3.1-pro-preview",
    });
    assert.equal(pro.input, 4);
    assert.equal(pro.output, 18);
    assert.equal(pro.cachedInput, 0.4);
  });

  it("prices cache reads below uncached input", () => {
    const uncached = estimateModelCostUsdMicros({
      inputTokens: 100_000,
      modelId: "anthropic/claude-sonnet-5",
      noCacheTokens: 100_000,
      outputTokens: 0,
    });
    const cached = estimateModelCostUsdMicros({
      cacheReadTokens: 100_000,
      inputTokens: 100_000,
      modelId: "anthropic/claude-sonnet-5",
      noCacheTokens: 0,
      outputTokens: 0,
    });
    assert.ok(cached < uncached);
    assert.equal(cached, Math.round(0.2 * 0.1 * 1_000_000));
  });

  it("applies long-context rates above threshold", () => {
    const short = resolveEffectiveRates({
      inputTokens: 100_000,
      modelId: "openai/gpt-5.4",
    });
    const long = resolveEffectiveRates({
      inputTokens: 300_000,
      modelId: "openai/gpt-5.4",
    });
    assert.equal(short.input, 2.5);
    assert.equal(long.input, 5);
    assert.equal(long.output, 22.5);
  });

  it("applies batch and fast service tiers", () => {
    const standard = resolveEffectiveRates({
      modelId: "openai/gpt-5.6-sol",
    });
    const batch = resolveEffectiveRates({
      modelId: "openai/gpt-5.6-sol",
      serviceTier: "batch",
    });
    const fast = resolveEffectiveRates({
      modelId: "openai/gpt-5.6-sol",
      serviceTier: "fast",
    });
    assert.equal(standard.input, 5);
    assert.equal(batch.input, 2.5);
    assert.equal(batch.cachedInput, 0.25);
    assert.equal(batch.cacheWrite5m, 3.125);
    assert.equal(fast.input, 10);
    assert.equal(fast.output, 60);
    assert.equal(fast.cacheWrite5m, 12.5);

    const opusFast = resolveEffectiveRates({
      modelId: "anthropic/claude-opus-4-8",
      serviceTier: "fast",
    });
    assert.equal(opusFast.input, 10);
    assert.equal(opusFast.output, 50);
    assert.equal(opusFast.cachedInput, 1);
  });

  it("does not invent OpenAI cache-write premiums when table shows dash", () => {
    const gpt5 = resolveEffectiveRates({ modelId: "openai/gpt-5" });
    assert.equal(gpt5.cachedInput, 0.125);
    // No "cache writes" column → writes bill at input, not 1.25×
    assert.equal(gpt5.cacheWrite5m, gpt5.input);
    assert.equal(gpt5.cacheWrite1h, gpt5.input);

    const sol = resolveEffectiveRates({ modelId: "openai/gpt-5.6-sol" });
    assert.equal(sol.cachedInput, 0.5);
    assert.equal(sol.cacheWrite5m, 6.25);
  });

  it("uses Anthropic table cache write and hit prices", () => {
    const sonnet = resolveEffectiveRates({
      modelId: "anthropic/claude-sonnet-5",
    });
    assert.equal(sonnet.cachedInput, 0.2);
    assert.equal(sonnet.cacheWrite5m, 2.5);
    assert.equal(sonnet.cacheWrite1h, 4);

    const write = estimateModelCostUsdMicros({
      cacheWriteTokens: 100_000,
      cacheWriteTtl: "5m",
      inputTokens: 100_000,
      modelId: "anthropic/claude-sonnet-5",
      noCacheTokens: 0,
      outputTokens: 0,
    });
    assert.equal(write, Math.round(2.5 * 0.1 * 1_000_000));
  });
});
