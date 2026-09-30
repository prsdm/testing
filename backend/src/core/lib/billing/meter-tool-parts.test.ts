import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countWebSearchesFromToolParts,
  listBillableImageGenerationsFromToolParts,
  listMeteredSandboxExecsFromToolParts,
} from "./meter-tool-parts";

describe("meter-tool-parts", () => {
  it("counts web searches from tool parts", () => {
    assert.equal(
      countWebSearchesFromToolParts([
        {
          input: { query: "latest news" },
          type: "tool-webSearch",
        },
      ]),
      1
    );
  });

  it("lists successful image generations and skips failures", () => {
    assert.deepEqual(
      listBillableImageGenerationsFromToolParts([
        {
          input: { prompt: "a cat", size: "1024x1536" },
          output: {
            name: "cat.png",
            url: "https://example.com/cat.png",
          },
          state: "output-available",
          type: "tool-generateImage",
        },
        {
          errorText: "blocked",
          input: { prompt: "blocked" },
          output: { error: "blocked" },
          state: "output-error",
          type: "tool-generateImage",
        },
        {
          input: { prompt: "pending" },
          state: "input-available",
          type: "tool-generateImage",
        },
      ]),
      [{ size: "1024x1536" }]
    );
  });

  it("defaults size when omitted", () => {
    assert.deepEqual(
      listBillableImageGenerationsFromToolParts([
        {
          input: { prompt: "logo" },
          output: { url: "https://example.com/logo.png" },
          state: "output-available",
          type: "tool-generateImage",
        },
      ]),
      [{}]
    );
  });

  it("lists successful sandbox execs and sums duration", () => {
    assert.deepEqual(
      listMeteredSandboxExecsFromToolParts([
        {
          output: { durationMs: 120, exitCode: 0 },
          state: "output-available",
          type: "tool-sandboxExec",
        },
        {
          errorText: "failed",
          output: { durationMs: 50, error: "failed", exitCode: 1 },
          state: "output-error",
          type: "tool-sandboxExec",
        },
      ]),
      [{ durationMs: 120 }]
    );
  });
});
