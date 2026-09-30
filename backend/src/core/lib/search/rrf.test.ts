import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weightedReciprocalRankFusion } from "./rrf";

describe("weightedReciprocalRankFusion", () => {
  it("merges overlapping ids with higher combined score", () => {
    const merged = weightedReciprocalRankFusion({
      idExtractor: (item) => item.id,
      k: 50,
      rankedResults: [
        [{ id: "a" }, { id: "b" }, { id: "c" }],
        [{ id: "c" }, { id: "a" }, { id: "d" }],
      ],
      weights: [1.2, 1],
    });

    assert.deepEqual(
      merged.map((item) => item.id),
      ["a", "c", "b", "d"]
    );
  });

  it("respects higher weight on first list", () => {
    const merged = weightedReciprocalRankFusion({
      idExtractor: (item) => item.id,
      k: 50,
      rankedResults: [[{ id: "kb" }], [{ id: "slack" }]],
      weights: [1.2, 0.5],
    });

    assert.equal(merged[0]?.id, "kb");
    assert.equal(merged[1]?.id, "slack");
  });

  it("interleaves equal-weight top hits from different sources", () => {
    const merged = weightedReciprocalRankFusion({
      idExtractor: (item) => item.id,
      k: 50,
      rankedResults: [
        [{ id: "kb-1" }, { id: "kb-2" }],
        [{ id: "slack-1" }, { id: "slack-2" }],
      ],
      weights: [1, 1],
    });

    assert.deepEqual(
      merged.map((item) => item.id),
      ["kb-1", "slack-1", "kb-2", "slack-2"]
    );
  });

  it("throws when weights length mismatches lists", () => {
    assert.throws(() =>
      weightedReciprocalRankFusion({
        idExtractor: (item) => item.id,
        rankedResults: [[{ id: "a" }]],
        weights: [1, 2],
      })
    );
  });
});
