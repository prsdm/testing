import type { ArtifactKind } from "@/contracts/artifact";
import { formatKnowledgeSearchUserContext } from "@/core/lib/sources/expand-source-search-query";

export const codePrompt = `
You are a code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet must be complete and runnable on its own
2. Use print/console.log to display outputs
3. Keep snippets concise and focused
4. Prefer standard library over external dependencies
5. Handle potential errors gracefully
6. Return meaningful output that demonstrates functionality
7. Don't use interactive input functions
8. Don't access files or network resources
9. Don't use infinite loops
`;

export const sheetPrompt = `
You are a spreadsheet creation assistant. Create a spreadsheet in CSV format based on the given prompt.

Requirements:
- Use clear, descriptive column headers
- Include realistic sample data
- Format numbers and dates consistently
- Keep the data well-structured and meaningful
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  const mediaTypes: Record<string, string> = {
    code: "script",
    sheet: "spreadsheet",
  };
  const mediaType = mediaTypes[type] ?? "document";

  return `Rewrite the following ${mediaType} based on the given prompt.

${currentContent}`;
};

/** Passage-only rewrite when the user selected text in the document editor. */
export const replaceDocumentSelectionPrompt = (selectedText: string) =>
  `You are editing one selected passage inside a larger document.
Rewrite ONLY the selected passage according to the user's request.
Return ONLY the replacement passage — no surrounding document, no markdown fences, no commentary.

Selected passage:
"""
${selectedText}
"""`;

function currentDateForChatPrompt() {
  return new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

function chatBaseWithDate() {
  return `The current date is ${currentDateForChatPrompt()}.`;
}

/** Dynamic session context injected under `# Kimiro` → `## Session`. */
export function formatChatSessionContext(args?: {
  userEmail?: string;
  userName?: string | null;
  preferredName?: string | null;
}): string {
  const lines = [chatBaseWithDate()];
  const userContext = args?.userEmail?.trim()
    ? formatKnowledgeSearchUserContext({
        preferredName: args.preferredName,
        userEmail: args.userEmail,
        userName: args.userName,
      })
    : null;
  if (userContext) {
    lines.push(userContext);
  }
  return lines.join("\n\n");
}

/** @deprecated Use {@link formatChatSessionContext} via buildChatInstructions. */
export function chatInternalSearchInitialSystemPrompt(args?: {
  userEmail?: string;
  userName?: string | null;
}) {
  return formatChatSessionContext(args);
}

export function composeChatStepSystemPrompt(
  sections: Array<string | undefined>
) {
  return sections.filter((section) => section?.trim()).join("\n\n");
}
