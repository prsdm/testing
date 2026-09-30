import {
  replaceDocumentSelectionPrompt,
  updateDocumentPrompt,
} from "@/core/lib/ai/prompts";
import { streamCompletionText } from "@/core/lib/ai/stream-completion";
import { createDocumentHandler } from "@/core/lib/artifacts/server";
import {
  encodeMarkdownAsDocxContent,
  replaceFirstPassage,
  textContentToPromptMarkdown,
} from "@/shared/artifacts/text-docx";

const textDocumentCreatePrompt =
  "Write about the given topic. Markdown is supported. Use headings wherever appropriate.";

function stripMarkdownFences(text: string) {
  return text
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({
    title,
    instructions,
    dataStream,
    modelId,
    llmKeys,
    billing,
  }) => {
    const draftContent = await streamCompletionText({
      billing,
      llmKeys,
      modelId,
      onTextDelta: (delta) => {
        dataStream.write({
          data: delta,
          transient: true,
          type: "data-textDelta",
        });
      },
      prompt: instructions?.trim() || title,
      system: textDocumentCreatePrompt,
    });

    const docxContent = await encodeMarkdownAsDocxContent(draftContent);
    dataStream.write({
      data: docxContent,
      transient: true,
      type: "data-textDelta",
    });
    return docxContent;
  },
  onUpdateDocument: async ({
    document,
    description,
    selectedText,
    dataStream,
    modelId,
    llmKeys,
    billing,
  }) => {
    const currentMarkdown = await textContentToPromptMarkdown(
      document.content ?? ""
    );
    const trimmedSelection = selectedText?.trim();

    if (trimmedSelection) {
      const rewrittenPassage = await streamCompletionText({
        billing,
        llmKeys,
        modelId,
        prompt: description,
        system: replaceDocumentSelectionPrompt(trimmedSelection),
      });

      const replacement = stripMarkdownFences(rewrittenPassage);
      const merged =
        replaceFirstPassage(currentMarkdown, trimmedSelection, replacement) ??
        null;

      if (merged !== null) {
        const docxContent = await encodeMarkdownAsDocxContent(merged);
        dataStream.write({
          data: docxContent,
          transient: true,
          type: "data-textDelta",
        });
        return docxContent;
      }
    }

    const draftContent = await streamCompletionText({
      billing,
      llmKeys,
      modelId,
      onTextDelta: (delta) => {
        dataStream.write({
          data: delta,
          transient: true,
          type: "data-textDelta",
        });
      },
      prompt: description,
      system: updateDocumentPrompt(currentMarkdown, "text"),
    });

    const docxContent = await encodeMarkdownAsDocxContent(draftContent);
    dataStream.write({
      data: docxContent,
      transient: true,
      type: "data-textDelta",
    });
    return docxContent;
  },
});
