import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatModel, titleModel } from "@/core/lib/ai/models.mock";

describe("mock language models", () => {
  it("exports chat and title mock models", () => {
    assert.ok(chatModel);
    assert.ok(titleModel);
    assert.equal(typeof chatModel.doGenerate, "function");
    assert.equal(typeof titleModel.doGenerate, "function");
  });
});
