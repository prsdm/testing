import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateFreeTrialAccess, FREE_TRIAL_QUERY_LIMIT } from "./free-trial";

describe("evaluateFreeTrialAccess", () => {
  it("allows the founder within the free limit", () => {
    const result = evaluateFreeTrialAccess({
      isFounder: true,
      queriesUsed: 0,
    });
    assert.equal(result.allowed, true);
    if (result.allowed) {
      assert.equal(result.remaining, FREE_TRIAL_QUERY_LIMIT);
    }
  });

  it("allows the founder on the last free query", () => {
    const result = evaluateFreeTrialAccess({
      isFounder: true,
      queriesUsed: FREE_TRIAL_QUERY_LIMIT - 1,
    });
    assert.equal(result.allowed, true);
    if (result.allowed) {
      assert.equal(result.remaining, 1);
    }
  });

  it("blocks the founder after free queries are used", () => {
    const result = evaluateFreeTrialAccess({
      isFounder: true,
      queriesUsed: FREE_TRIAL_QUERY_LIMIT,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.code, "free_trial_exhausted");
    }
  });

  it("never grants free queries to non-founders", () => {
    const result = evaluateFreeTrialAccess({
      isFounder: false,
      queriesUsed: 0,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.equal(result.code, "not_subscribed");
    }
  });
});
