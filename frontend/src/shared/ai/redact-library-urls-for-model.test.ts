import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelMessage } from "ai";
import { truncateToolResultsInModelMessages } from "@/shared/ai/context-harness/truncate-tool-results";
import { redactLibraryToolOutputForModel } from "@/shared/ai/redact-library-urls-for-model";

describe("redactLibraryToolOutputForModel", () => {
  it("removes url from saveToLibrary output", () => {
    const redacted = redactLibraryToolOutputForModel("saveToLibrary", {
      contextForLlm: 'Saved "deck.pptx" to library.',
      id: "file-1",
      name: "deck.pptx",
      url: "/api/files/content?pathname=library%2Fx",
    }) as Record<string, unknown>;

    assert.equal(redacted.url, undefined);
    assert.equal(redacted.name, undefined);
  });

  it("removes url from listLibrary files", () => {
    const redacted = redactLibraryToolOutputForModel("listLibrary", {
      contextForLlm: "- a.pdf (application/pdf, 100 bytes)",
      files: [
        { name: "a.pdf", url: "/api/files/content?pathname=library%2Fa" },
      ],
    }) as { files: Array<{ url?: string; name: string }> };

    assert.equal(redacted.files[0]?.url, undefined);
    assert.equal(redacted.files[0]?.name, "a.pdf");
  });
});

describe("truncateToolResultsInModelMessages library redaction", () => {
  it("strips url before the model sees saveToLibrary results", () => {
    const messages: ModelMessage[] = [
      {
        content: [
          {
            output: {
              type: "json",
              value: {
                contextForLlm: 'Saved "report.pdf" to library.',
                id: "file-1",
                name: "report.pdf",
                url: "/api/files/content?pathname=library%2Freport.pdf",
              },
            },
            toolCallId: "call-1",
            toolName: "saveToLibrary",
            type: "tool-result",
          },
        ],
        role: "tool",
      },
    ];

    const sanitized = truncateToolResultsInModelMessages(messages);
    const part = sanitized[0]?.content;
    assert.ok(Array.isArray(part));
    const value = (
      part[0] as { output?: { value?: { url?: string; name?: string } } }
    ).output?.value;
    assert.equal(value?.url, undefined);
    assert.equal(value?.name, undefined);
  });
});
