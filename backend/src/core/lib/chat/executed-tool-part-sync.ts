import type { ChatMessagePart } from "@/shared/types";

function isToolPart(
  part: ChatMessagePart
): part is ChatMessagePart & { toolCallId: string; state: string } {
  return (
    part.type.startsWith("tool-") && "toolCallId" in part && "state" in part
  );
}

/** Tool parts that finished server-side execution after approval. */
export function extractExecutedToolPartUpdates(args: {
  previousParts: ChatMessagePart[];
  nextParts: ChatMessagePart[];
}): ChatMessagePart[] {
  const previousById = new Map(
    args.previousParts.filter(isToolPart).map((part) => [part.toolCallId, part])
  );
  const updates: ChatMessagePart[] = [];

  for (const part of args.nextParts) {
    if (!isToolPart(part)) {
      continue;
    }
    const previous = previousById.get(part.toolCallId);
    if (!previous) {
      continue;
    }
    if (
      previous.state === "approval-responded" &&
      part.state === "output-available" &&
      "output" in part &&
      part.output !== undefined
    ) {
      updates.push(part);
    }
  }

  return updates;
}

function encodeBase64Url(text: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/[=]+$/, "");
}

function decodeBase64Url(encoded: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(encoded, "base64url").toString("utf8");
  }
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeExecutedToolPartSync(parts: ChatMessagePart[]): string {
  return encodeBase64Url(JSON.stringify(parts));
}

export function decodeExecutedToolPartSync(encoded: string): ChatMessagePart[] {
  const parsed = JSON.parse(decodeBase64Url(encoded));
  return Array.isArray(parsed) ? (parsed as ChatMessagePart[]) : [];
}
