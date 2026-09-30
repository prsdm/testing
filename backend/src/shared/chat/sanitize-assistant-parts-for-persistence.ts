import { normalizeChatMessageParts } from "@/shared/chat/workflow-tool-parts";
import type { ChatMessagePart } from "@/shared/types";

/** Drop in-flight stream fragments before writing assistant parts to the database. */
export function sanitizeAssistantPartsForPersistence(
  parts: ChatMessagePart[]
): ChatMessagePart[] {
  const stabilized = parts.flatMap((part): ChatMessagePart[] => {
    if (part.type === "reasoning" && part.state === "streaming") {
      return part.text.trim() ? [{ ...part, state: "done" as const }] : [];
    }
    if (
      part.type.startsWith("tool-") &&
      "state" in part &&
      (part.state === "input-streaming" || part.state === "input-available")
    ) {
      return [];
    }
    return [part];
  });

  return normalizeChatMessageParts(stabilized);
}

/** Room live sync: keep in-flight tools visible to peers (not only final persistence). */
export function sanitizeAssistantPartsForRoomLiveSync(
  parts: ChatMessagePart[]
): ChatMessagePart[] {
  const stabilized = parts.flatMap((part): ChatMessagePart[] => {
    if (part.type === "reasoning" && part.state === "streaming") {
      return part.text.trim() ? [{ ...part, state: "done" as const }] : [];
    }
    if (
      part.type.startsWith("tool-") &&
      "state" in part &&
      part.state === "input-streaming"
    ) {
      return [];
    }
    return [part];
  });

  return normalizeChatMessageParts(stabilized);
}

export function roomLiveAssistantPartsAreVisible(
  parts: ChatMessagePart[]
): boolean {
  return parts.some((part) => {
    if (part.type === "text") {
      return Boolean(part.text?.trim());
    }
    if (part.type === "reasoning") {
      return Boolean(part.text?.trim());
    }
    return part.type.startsWith("tool-");
  });
}
