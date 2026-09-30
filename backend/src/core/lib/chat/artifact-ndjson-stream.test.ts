import assert from "node:assert/strict";
import test from "node:test";
import { createArtifactNdjsonTransform } from "./artifact-ndjson-stream";

test("encodes durable artifact parts as newline-delimited JSON", async () => {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue({ data: "hello", type: "data-textDelta" });
      controller.close();
    },
  });
  const reader = source
    .pipeThrough(createArtifactNdjsonTransform())
    .pipeThrough(new TextDecoderStream())
    .getReader();

  const first = await reader.read();
  assert.deepEqual(JSON.parse(String(first.value).trim()), {
    data: "hello",
    type: "data-textDelta",
  });
  assert.equal((await reader.read()).done, true);
});
