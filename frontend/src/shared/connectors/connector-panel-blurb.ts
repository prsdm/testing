const DEFAULT_MAX_WORDS = 5;

/** Short line for connector grid cards (about 4–5 words). */
export function connectorPanelBlurb(
  text: string,
  fallback = "",
  maxWords = DEFAULT_MAX_WORDS
): string {
  const source = text.trim() || fallback.trim();
  if (!source) {
    return "";
  }
  const words = source.split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}
