import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateImageInputSchema,
  imageFileNameFromPrompt,
  isFailedGenerateImageResult,
  isSuccessfulGenerateImageOutput,
  normalizeGenerateImageInput,
} from "./generate-image";

describe("isFailedGenerateImageResult", () => {
  it("detects error payloads", () => {
    assert.equal(
      isFailedGenerateImageResult({ error: "Request blocked by policy" }),
      true
    );
    assert.equal(isFailedGenerateImageResult({ url: "/image.png" }), false);
  });
});

describe("isSuccessfulGenerateImageOutput", () => {
  it("detects successful image payloads", () => {
    assert.equal(
      isSuccessfulGenerateImageOutput({
        contentType: "image/png",
        contextForLlm: "Generated",
        id: "1",
        name: "hero.png",
        prompt: "A hero image",
        sizeBytes: 100,
        url: "/library/hero.png",
      }),
      true
    );
    assert.equal(
      isSuccessfulGenerateImageOutput({ error: "Request blocked" }),
      false
    );
    assert.equal(isSuccessfulGenerateImageOutput({ url: "  " }), false);
  });
});

describe("normalizeGenerateImageInput", () => {
  it("accepts a trimmed prompt", () => {
    const parsed = generateImageInputSchema.parse({
      prompt: "  A minimal SaaS hero illustration  ",
      size: "1024x1024",
    });
    const result = normalizeGenerateImageInput(parsed);
    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.prompt, "A minimal SaaS hero illustration");
      assert.equal(result.size, "1024x1024");
    }
  });

  it("rejects empty prompts", () => {
    const parsed = generateImageInputSchema.parse({ prompt: "   " });
    const result = normalizeGenerateImageInput(parsed);
    assert.equal("error" in result, true);
  });
});

describe("imageFileNameFromPrompt", () => {
  it("builds a safe png filename from the prompt", () => {
    assert.equal(
      imageFileNameFromPrompt("Hero for Q4 launch!!"),
      "hero-for-q4-launch.png"
    );
  });
});
