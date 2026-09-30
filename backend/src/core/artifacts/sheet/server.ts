import { sheetPrompt, updateDocumentPrompt } from "@/core/lib/ai/prompts";
import { streamCompletionText } from "@/core/lib/ai/stream-completion";
import { createDocumentHandler } from "@/core/lib/artifacts/server";
import {
  csvToAoA,
  decodeWorkbook,
  encodeCsvAsXlsxContent,
  replaceSheetInWorkbook,
  sheetContentToPromptCsv,
  sheetTabName,
} from "@/shared/artifacts/sheet-xlsx";

function stripCsvFences(csv: string): string {
  return csv
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  onCreateDocument: async ({
    title,
    instructions,
    dataStream,
    modelId,
    llmKeys,
    billing,
  }) => {
    let draftContent = "";
    const tabName = sheetTabName(title);
    const prompt = instructions?.trim() || title;

    await streamCompletionText({
      billing,
      llmKeys,
      modelId,
      onTextDelta: (delta) => {
        draftContent += delta;
        dataStream.write({
          data: stripCsvFences(draftContent),
          transient: true,
          type: "data-sheetDelta",
        });
      },
      prompt,
      system: `${sheetPrompt}

Output ONLY the raw CSV data. No explanations, no markdown fences.`,
    });

    const csv = stripCsvFences(draftContent);
    const xlsxContent = encodeCsvAsXlsxContent(csv, tabName);
    dataStream.write({
      data: xlsxContent,
      transient: true,
      type: "data-sheetDelta",
    });
    return xlsxContent;
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
    const existing = document.content ?? "";
    const currentCsv = sheetContentToPromptCsv(existing);
    const primarySheetName =
      decodeWorkbook(existing).at(0)?.name ?? sheetTabName(document.title);

    await streamCompletionText({
      billing,
      llmKeys,
      modelId,
      onTextDelta: (delta) => {
        draftContent += delta;
        dataStream.write({
          data: stripCsvFences(draftContent),
          transient: true,
          type: "data-sheetDelta",
        });
      },
      prompt: description,
      system: `${updateDocumentPrompt(currentCsv, "sheet")}

Output ONLY the raw CSV data for the primary sheet. No explanations, no markdown fences.
Other worksheets in the workbook will be preserved.`,
    });

    const csv = stripCsvFences(draftContent);
    const xlsxContent = replaceSheetInWorkbook(
      existing,
      primarySheetName,
      csvToAoA(csv)
    );
    dataStream.write({
      data: xlsxContent,
      transient: true,
      type: "data-sheetDelta",
    });
    return xlsxContent;
  },
});
