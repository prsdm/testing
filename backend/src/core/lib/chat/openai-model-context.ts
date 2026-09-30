/** Parts safe to keep when converting UI messages for OpenAI model context. */
export function shouldKeepOpenAiModelContextPart(part: {
  type: string;
}): boolean {
  if (part.type === "text" || part.type === "file") {
    return true;
  }
  if (part.type === "tool-webSearch" || part.type === "tool-openUrl") {
    return false;
  }
  return part.type.startsWith("tool-");
}
