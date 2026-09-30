export function messagePlainTextFromRow(args: {
  parts: unknown;
  metadata: unknown;
}): string {
  const chunks: string[] = [];
  if (Array.isArray(args.parts)) {
    for (const part of args.parts) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: string }).text === "string"
      ) {
        const text = (part as { text: string }).text.trim();
        if (text) {
          chunks.push(text);
        }
      }
    }
  }
  const metadata = args.metadata;
  if (metadata && typeof metadata === "object") {
    const composerText = (metadata as { composerText?: unknown }).composerText;
    if (typeof composerText === "string" && composerText.trim()) {
      chunks.push(composerText.trim());
    }
  }
  return chunks.join("\n");
}

export function buildMessageSearchSnippet(args: {
  text: string;
  query: string;
  maxLength?: number;
}): string {
  const maxLength = args.maxLength ?? 140;
  const normalizedText = args.text.replace(/\s+/g, " ").trim();
  const normalizedQuery = args.query.trim();
  if (!normalizedText) {
    return "";
  }
  const lowerText = normalizedText.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  if (matchIndex < 0) {
    return normalizedText.slice(0, maxLength);
  }
  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(
    normalizedText.length,
    matchIndex + normalizedQuery.length + 60
  );
  let snippet = normalizedText.slice(start, end);
  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < normalizedText.length) {
    snippet = `${snippet}…`;
  }
  return snippet.slice(0, maxLength);
}
