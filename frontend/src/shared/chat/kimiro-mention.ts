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

export type KimiroMentionSegment =
  | { kind: "text"; value: string }
  | { kind: "mention"; value: string };

/** `@kimiro` and room member handles like `@Ada` in sent message text. */
const ROOM_MENTION_TOKEN = /\B@[\w.-]+/g;

export function splitTextWithRoomMentions(
  text: string
): KimiroMentionSegment[] {
  const segments: KimiroMentionSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(ROOM_MENTION_TOKEN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, index) });
    }
    segments.push({ kind: "mention", value: match[0] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ kind: "text", value: text }];
}

export function splitTextWithKimiroMentions(
  text: string
): KimiroMentionSegment[] {
  return splitTextWithRoomMentions(text);
}
