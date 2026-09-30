const KIMIRO_MENTION_PATTERN = /\B@kimiro\b/i;

export function messageInvokesKimiro(text: string): boolean {
  return KIMIRO_MENTION_PATTERN.test(text);
}

export function stripKimiroMention(text: string): string {
  return text
    .replace(/\B@kimiro\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
