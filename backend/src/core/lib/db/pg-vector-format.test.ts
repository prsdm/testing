import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPgVector } from "@/core/lib/db/pg-vector";
import { EMBEDDING_DIMENSION } from "@/core/lib/search/constants";

describe("formatPgVector", () => {
  it("formats embeddings for pgvector literals", () => {
    const values = Array.from(
      { length: EMBEDDING_DIMENSION },
      (_, index) => index * 0.001
    );
    const literal = formatPgVector(values);
    assert.match(literal, /^\[/);
    assert.match(literal, /\]$/);
    assert.equal(literal.split(",").length, EMBEDDING_DIMENSION);
  });
});
