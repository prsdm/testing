"use client";

/** Focus the main chat composer and place the caret at the end. */
export function focusComposerInput() {
  requestAnimationFrame(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-testid="multimodal-input"]'
    );
    textarea?.focus();
    const length = textarea?.value.length ?? 0;
    textarea?.setSelectionRange(length, length);
  });
}

export type ComposerDocumentSelection = {
  /** Plain text for chip preview. */
  text: string;
  /**
   * Markdown (or plain) passage to pass as updateDocument.selectedText.
   * Defaults to `text` when omitted.
   */
  selectedText?: string;
  documentId: string;
  title: string;
};

/** Truncate selection for the composer chip preview. */
export function truncateSelectionPreview(text: string, maxLength = 120) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

/**
 * Build the model-facing user message when a document selection chip is attached.
 * The visible chat bubble uses metadata.composerText instead of this full string.
 */
export function buildDocumentSelectionMessage(args: {
  userText: string;
  selection: ComposerDocumentSelection;
}) {
  const selectedText = (
    args.selection.selectedText ?? args.selection.text
  ).trim();

  return `The user selected a passage from the open chat artifact document "${args.selection.title}" (id: ${args.selection.documentId}). Call updateDocument with that id and pass selectedText set to the EXACT selected passage below so only that part is rewritten. Do not say you lack access to the selection.

selectedText:
"""
${selectedText}
"""

User request:
${args.userText.trim()}`;
}
