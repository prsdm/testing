import type { KimiroMentionSegment } from "@/shared/chat/kimiro-mention";

export type RoomMentionTarget =
  | {
      kind: "agent";
      handle: "kimiro";
      label: "Kimiro";
      description: string;
    }
  | {
      kind: "member";
      userId: string;
      handle: string;
      label: string;
      description: string;
      isSelf?: boolean;
    };

const ROOM_MENTION_TOKEN = /\B@[\w.-]+/g;

export type ActiveRoomMention = {
  /** Index of `@` in the full input string. */
  at: number;
  /** Cursor index (exclusive end of the partial mention). */
  end: number;
  query: string;
};

const KIMIRO_AGENT: RoomMentionTarget = {
  description: "Ask the AI agent in this conversation",
  handle: "kimiro",
  kind: "agent",
  label: "Kimiro",
};

/** Partial `@mention` being typed at the cursor (Slack-style, single token). */
export function parseActiveRoomMention(
  value: string,
  cursor: number
): ActiveRoomMention | null {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, safeCursor);
  const at = before.lastIndexOf("@");
  if (at < 0) {
    return null;
  }
  if (at > 0 && !/\s/.test(before.charAt(at - 1))) {
    return null;
  }
  const query = before.slice(at + 1);
  if (/\s/.test(query)) {
    return null;
  }
  return { at, end: safeCursor, query };
}

export function mentionHandleFromMember(args: {
  displayName: string;
  email: string;
}): string {
  const first = args.displayName.trim().split(/\s+/)[0];
  if (first) {
    const sanitized = first.replace(/[^\w.-]/g, "");
    if (sanitized) {
      return sanitized;
    }
  }
  const local = args.email.split("@")[0]?.trim();
  return local?.replace(/[^\w.-]/g, "") || "member";
}

export function buildRoomMentionTargets(args: {
  members: Array<{ userId: string; displayName: string; email: string }>;
  sessionUserId?: string | null;
}): RoomMentionTarget[] {
  const targets: RoomMentionTarget[] = [KIMIRO_AGENT];
  const seen = new Set<string>();

  for (const member of args.members) {
    if (seen.has(member.userId)) {
      continue;
    }
    seen.add(member.userId);
    const isSelf = Boolean(
      args.sessionUserId && member.userId === args.sessionUserId
    );
    targets.push({
      description: member.email,
      handle: mentionHandleFromMember(member),
      isSelf,
      kind: "member",
      label: member.displayName,
      userId: member.userId,
    });
  }

  return targets;
}

export function filterRoomMentionTargets(
  targets: RoomMentionTarget[],
  query: string
): RoomMentionTarget[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return targets;
  }
  return targets.filter((target) => {
    if (target.kind === "agent") {
      return (
        "kimiro".startsWith(normalized) ||
        target.label.toLowerCase().startsWith(normalized)
      );
    }
    return (
      target.handle.toLowerCase().startsWith(normalized) ||
      target.label.toLowerCase().includes(normalized) ||
      target.description.toLowerCase().includes(normalized)
    );
  });
}

export function roomMentionHandleSet(
  targets: RoomMentionTarget[]
): Set<string> {
  const handles = new Set<string>();
  for (const target of targets) {
    handles.add(
      (target.kind === "agent" ? "kimiro" : target.handle).toLowerCase()
    );
  }
  return handles;
}

/** Slack-style: highlight only resolved handles, not the token being typed. */
export function splitTextForComposerMentionHighlight(args: {
  text: string;
  cursor: number;
  handles: Set<string>;
}): KimiroMentionSegment[] {
  const { text, cursor, handles } = args;
  const active = parseActiveRoomMention(text, cursor);
  const segments: KimiroMentionSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(ROOM_MENTION_TOKEN)) {
    const index = match.index ?? 0;
    const value = match[0];
    const end = index + value.length;

    if (index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, index) });
    }

    const handle = value.slice(1).toLowerCase();
    const overlapsActive =
      active !== null && index < active.end && end > active.at;
    const isCompleted = !overlapsActive && handles.has(handle);

    segments.push({
      kind: isCompleted ? "mention" : "text",
      value,
    });
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: "text", value: text }];
}

export function insertRoomMention(args: {
  value: string;
  mention: ActiveRoomMention;
  handle: string;
}): { nextValue: string; cursor: number } {
  const insert = `@${args.handle} `;
  const nextValue =
    args.value.slice(0, args.mention.at) +
    insert +
    args.value.slice(args.mention.end);
  return { cursor: args.mention.at + insert.length, nextValue };
}
