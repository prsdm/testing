import { codePrompt, updateDocumentPrompt } from "@/core/lib/ai/prompts";
import { streamCompletionText } from "@/core/lib/ai/stream-completion";
import { createDocumentHandler } from "@/core/lib/artifacts/server";

function stripFences(code: string): string {
  return code
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  onCreateDocument: async ({
    title,
    instructions,
    dataStream,
    modelId,
    llmKeys,
    billing,
  }) => {
    let draftContent = "";

    await streamCompletionText({
      billing,
      llmKeys,
      modelId,
      onTextDelta: (delta) => {
        draftContent += delta;
        dataStream.write({
          data: stripFences(draftContent),
          transient: true,
          type: "data-codeDelta",
        });
      },
      prompt: instructions?.trim() || title,
      system: codePrompt,
    });

    return stripFences(draftContent);
  },
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    modelId,
    llmKeys,
    billing,
  }) => {
    let draftContent = "";

    await streamCompletionText({
      billing,
      llmKeys,
      modelId,
      onTextDelta: (delta) => {
        draftContent += delta;
        dataStream.write({
          data: stripFences(draftContent),
          transient: true,
          type: "data-codeDelta",
        });
      },
      prompt: description,
      system: updateDocumentPrompt(document.content, "code"),
    });

    return stripFences(draftContent);
  },
});
