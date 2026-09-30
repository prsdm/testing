/** OpenAI reasoning summaries often stream one token per line — join before markdown. */
export function collapseTokenizedReasoningLines(text: string): string {
  const lines = text.split("\n").map((line) => line.trim());
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length <= 1) {
    return text;
  }

  const singleTokenLines = nonEmpty.filter((line) => !/\s/.test(line)).length;
  if (singleTokenLines / nonEmpty.length >= 0.6) {
    return nonEmpty.join(" ");
  }

  return text;
}

export function normalizeThinkingText(text: string): string {
  let out = collapseTokenizedReasoningLines(text);
  out = out.replace(/\s+([,.;:!?])/g, "$1");
  out = out.replace(/"([^"\n]+)"/g, (_match, inner: string) => {
    const trimmed = inner.trim();
    const repaired = /^[A-Z]+(?:\s+[A-Z]+)+$/.test(trimmed)
      ? trimmed.replace(/\s+/g, "")
      : trimmed;
    return `"${repaired}"`;
  });
  out = out.replace(
    /\b([A-Za-z0-9])((?:\s+[A-Za-z0-9]{1,3})+)\s*\.(docx?|txt|pdf|xlsx?|csv|pptx?)\b/gi,
    (_match, first: string, rest: string, extension: string) =>
      `${first}${rest.replace(/\s+/g, "")}.${extension}`
  );
  out = out.replace(/(?<!\n)\n(?!\n)/g, "\n\n");
  out = out.replace(/([.!?)\]])(\*\*[^*\n]+\*\*)/g, "$1\n\n$2");
  out = out.replace(/(\*\*[^*\n]+\*\*)\s+(?=[A-Z])/g, "$1\n\n");
  return out;
}

/** Stable comparison key for streamed/finalized reasoning formatting variants. */
export function reasoningComparisonKey(text: string): string {
  return collapseTokenizedReasoningLines(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s*["“”]\s*/g, '"')
    .trim();
}

export function compactReasoningComparisonKey(text: string): string {
  return reasoningComparisonKey(text).replace(/\s+/g, "");
}
