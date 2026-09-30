/** Ensure block-level markdown lists parse by separating them from prior paragraphs. */
export function normalizeMarkdownLists(text: string) {
  return text.replace(/([^\n])\n([ \t]*[-*+]\s+)/g, "$1\n\n$2");
}
