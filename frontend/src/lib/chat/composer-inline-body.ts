import { nanoid } from "nanoid";
import type { ActiveRoomMention } from "@/lib/chat/room-mention-autocomplete";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import {
  connectorFocusMentionHandle,
  connectorFocusMentionToken,
  parseComposerConnectorFocus,
} from "@/shared/connectors/composer-connector-focus";
import { composerFocusKey } from "@/shared/connectors/composer-connector-focuses";

export type ComposerInlineTextSegment = {
  kind: "text";
  id: string;
  text: string;
};

export type ComposerInlineConnectorSegment = {
  kind: "connector";
  id: string;
  focus: ComposerConnectorFocus;
};

export type ComposerInlineSegment =
  | ComposerInlineTextSegment
  | ComposerInlineConnectorSegment;

export type ComposerInlineBody = {
  segments: ComposerInlineSegment[];
};

export function emptyComposerInlineBody(): ComposerInlineBody {
  return {
    segments: [{ id: nanoid(), kind: "text", text: "" }],
  };
}

export function stripInlineConnectorSegments(
  body: ComposerInlineBody
): ComposerInlineBody {
  const segments = body.segments.filter(
    (segment) => segment.kind !== "connector"
  );
  if (segments.length === 0) {
    return emptyComposerInlineBody();
  }
  return { segments: mergeAdjacentTextSegments(segments) };
}

/** True when the draft is only scoped tool chip(s), no user text. */
export function inlineBodyIsConnectorToolChipOnly(
  body: ComposerInlineBody
): boolean {
  if (!inlineBodyHasConnectorSegments(body)) {
    return false;
  }
  return body.segments.every(
    (segment) =>
      segment.kind === "connector" ||
      (segment.kind === "text" && !segment.text.trim())
  );
}

export function mergeAdjacentTextSegments(
  segments: ComposerInlineSegment[]
): ComposerInlineSegment[] {
  const merged: ComposerInlineSegment[] = [];
  for (const segment of segments) {
    if (segment.kind !== "text") {
      merged.push(segment);
      continue;
    }
    const previous = merged.at(-1);
    if (previous?.kind === "text") {
      previous.text += segment.text;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}

export function composerInlinePlainText(body: ComposerInlineBody): string {
  return body.segments
    .map((segment) => (segment.kind === "text" ? segment.text : " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain string sent to the model (includes @handles for connector segments). */
export function composerInlineWireText(body: ComposerInlineBody): string {
  return body.segments
    .map((segment) =>
      segment.kind === "text"
        ? segment.text
        : connectorFocusMentionToken(segment.focus)
    )
    .join("");
}

export function composerInlineHasContent(body: ComposerInlineBody): boolean {
  if (
    body.segments.some(
      (segment): segment is ComposerInlineConnectorSegment =>
        segment.kind === "connector"
    )
  ) {
    return true;
  }
  return body.segments.some(
    (segment) => segment.kind === "text" && segment.text.trim().length > 0
  );
}

export function inlineBodyFromPlainText(
  text: string,
  targets: Array<{ handle: string; focus: ComposerConnectorFocus }>
): ComposerInlineBody {
  if (!text) {
    return emptyComposerInlineBody();
  }
  if (targets.length === 0 || !text.includes("@")) {
    return {
      segments: [{ id: nanoid(), kind: "text", text }],
    };
  }
  const handleToFocus = new Map<string, ComposerConnectorFocus>();
  for (const target of targets) {
    handleToFocus.set(target.handle.toLowerCase(), target.focus);
    if (target.focus.kind === "work-skill") {
      handleToFocus.set(target.focus.skillId.toLowerCase(), target.focus);
    }
  }
  const segments: ComposerInlineSegment[] = [];
  const token = /\B@([\w.-]+)/g;
  let lastIndex = 0;
  let matchedConnector = false;
  for (const match of text.matchAll(token)) {
    const rawHandle = match[1];
    if (!rawHandle) {
      continue;
    }
    const focus = handleToFocus.get(rawHandle.toLowerCase());
    if (!focus) {
      continue;
    }
    matchedConnector = true;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({
        id: nanoid(),
        kind: "text",
        text: text.slice(lastIndex, index),
      });
    }
    segments.push({
      focus,
      id: nanoid(),
      kind: "connector",
    });
    lastIndex = index + match[0].length;
  }
  if (!matchedConnector) {
    return {
      segments: [{ id: nanoid(), kind: "text", text }],
    };
  }
  if (lastIndex < text.length) {
    segments.push({
      id: nanoid(),
      kind: "text",
      text: text.slice(lastIndex),
    });
  }
  return { segments: mergeAdjacentTextSegments(segments) };
}

export function removeInlineConnectorFocus(
  body: ComposerInlineBody,
  focus: ComposerConnectorFocus
): ComposerInlineBody {
  const key = composerFocusKey(focus);
  return {
    segments: mergeAdjacentTextSegments(
      body.segments.filter(
        (segment) =>
          segment.kind !== "connector" ||
          composerFocusKey(segment.focus) !== key
      )
    ),
  };
}

export function insertRoomMentionIntoInlineBody(args: {
  body: ComposerInlineBody;
  textSegmentId: string;
  mention: ActiveRoomMention;
  handle: string;
}): { body: ComposerInlineBody; cursorSegmentId: string; cursor: number } {
  const segments = args.body.segments.flatMap((segment) => {
    if (segment.kind !== "text" || segment.id !== args.textSegmentId) {
      return [segment];
    }
    const before = segment.text.slice(0, args.mention.at);
    const after = segment.text.slice(args.mention.end);
    const token = `@${args.handle}`;
    const textAfterToken =
      after.length === 0 || !/^\s/.test(after) ? ` ${after}` : after;
    const next: ComposerInlineSegment[] = [];
    if (before) {
      next.push({ id: nanoid(), kind: "text", text: before });
    }
    const textId = nanoid();
    next.push({
      id: textId,
      kind: "text",
      text: `${token}${textAfterToken}`,
    });
    return next;
  });
  const merged = mergeAdjacentTextSegments(segments);
  const lastText = [...merged]
    .reverse()
    .find((entry): entry is ComposerInlineTextSegment => entry.kind === "text");
  const insert = `@${args.handle} `;
  const cursor = lastText
    ? lastText.text.lastIndexOf(insert) + insert.length
    : 0;
  return {
    body: { segments: merged },
    cursor,
    cursorSegmentId: lastText?.id ?? args.textSegmentId,
  };
}

export function composerInlineFocuses(
  body: ComposerInlineBody
): ComposerConnectorFocus[] {
  return body.segments
    .filter(
      (segment): segment is ComposerInlineConnectorSegment =>
        segment.kind === "connector"
    )
    .map((segment) => segment.focus);
}

function insertAtWireMention(args: {
  body: ComposerInlineBody;
  mention: ActiveRoomMention;
  insert: (
    localText: string,
    localAt: number,
    localEnd: number
  ) => ComposerInlineSegment[];
}): ComposerInlineBody {
  let wireOffset = 0;
  const next: ComposerInlineSegment[] = [];
  for (const segment of args.body.segments) {
    if (segment.kind === "connector") {
      const token = connectorFocusMentionToken(segment.focus);
      const start = wireOffset;
      const end = wireOffset + token.length;
      if (args.mention.at < end && args.mention.end > start) {
        return args.body;
      }
      wireOffset = end;
      next.push(segment);
      continue;
    }
    const text = segment.text;
    const start = wireOffset;
    const end = wireOffset + text.length;
    if (args.mention.at < end && args.mention.end > start) {
      const localAt = Math.max(0, args.mention.at - start);
      const localEnd = Math.min(text.length, args.mention.end - start);
      next.push(...args.insert(text, localAt, localEnd));
      wireOffset = end;
      continue;
    }
    wireOffset = end;
    next.push(segment);
  }
  return { segments: mergeAdjacentTextSegments(next) };
}

export function insertConnectorAtWireMention(args: {
  body: ComposerInlineBody;
  mention: ActiveRoomMention;
  focus: ComposerConnectorFocus;
}): ComposerInlineBody {
  return insertAtWireMention({
    body: args.body,
    mention: args.mention,
    insert: (text, localAt, localEnd) => {
      const pieces: ComposerInlineSegment[] = [];
      const before = text.slice(0, localAt);
      const after = text.slice(localEnd);
      const textAfterConnector =
        after.length === 0 || !/^\s/.test(after) ? ` ${after}` : after;
      if (before) {
        pieces.push({ id: nanoid(), kind: "text", text: before });
      }
      pieces.push({
        focus: args.focus,
        id: nanoid(),
        kind: "connector",
      });
      pieces.push({
        id: nanoid(),
        kind: "text",
        text: textAfterConnector,
      });
      return pieces;
    },
  });
}

export function insertRoomMentionAtWireMention(args: {
  body: ComposerInlineBody;
  handle: string;
  mention: ActiveRoomMention;
}): ComposerInlineBody {
  const token = `@${args.handle}`;
  return insertAtWireMention({
    body: args.body,
    mention: args.mention,
    insert: (text, localAt, localEnd) => {
      const before = text.slice(0, localAt);
      const after = text.slice(localEnd);
      const textAfterToken =
        after.length === 0 || !/^\s/.test(after) ? ` ${after}` : after;
      return [
        ...(before
          ? [{ id: nanoid(), kind: "text" as const, text: before }]
          : []),
        {
          id: nanoid(),
          kind: "text" as const,
          text: `${token}${textAfterToken}`,
        },
      ];
    },
  });
}

export function insertConnectorIntoInlineBody(args: {
  body: ComposerInlineBody;
  textSegmentId: string;
  mention: ActiveRoomMention;
  focus: ComposerConnectorFocus;
}): ComposerInlineBody {
  const segments = args.body.segments.flatMap((segment) => {
    if (segment.kind !== "text" || segment.id !== args.textSegmentId) {
      return [segment];
    }
    const before = segment.text.slice(0, args.mention.at);
    const after = segment.text.slice(args.mention.end);
    const textAfterConnector =
      after.length === 0 || !/^\s/.test(after) ? ` ${after}` : after;
    const next: ComposerInlineSegment[] = [];
    if (before) {
      next.push({ id: nanoid(), kind: "text", text: before });
    }
    next.push({
      focus: args.focus,
      id: nanoid(),
      kind: "connector",
    });
    next.push({
      id: segment.id,
      kind: "text",
      text: textAfterConnector,
    });
    return next;
  });

  return {
    segments: mergeAdjacentTextSegments(segments),
  };
}

export function removeInlineConnectorSegment(
  body: ComposerInlineBody,
  segmentId: string
): ComposerInlineBody {
  return {
    segments: mergeAdjacentTextSegments(
      body.segments.filter((segment) => segment.id !== segmentId)
    ),
  };
}

export function updateInlineTextSegment(
  body: ComposerInlineBody,
  segmentId: string,
  text: string
): ComposerInlineBody {
  return {
    segments: body.segments.map((segment) =>
      segment.kind === "text" && segment.id === segmentId
        ? { ...segment, text }
        : segment
    ),
  };
}

export function appendInlineConnectorSegment(
  body: ComposerInlineBody,
  focus: ComposerConnectorFocus
): ComposerInlineBody {
  const segments = [...body.segments];
  const last = segments.at(-1);
  if (last?.kind === "text" && !last.text) {
    segments.pop();
  }
  segments.push({
    focus,
    id: nanoid(),
    kind: "connector",
  });
  segments.push({ id: nanoid(), kind: "text", text: "" });
  return { segments: mergeAdjacentTextSegments(segments) };
}

function composerSegmentWireLength(segment: ComposerInlineSegment): number {
  if (segment.kind === "text") {
    return segment.text.length;
  }
  return connectorFocusMentionToken(segment.focus).length;
}

/** Insert another inline body at a wire-text offset (e.g. clipboard paste). */
export function insertComposerInlineBodyAtWireOffset(
  body: ComposerInlineBody,
  offset: number,
  insertBody: ComposerInlineBody
): ComposerInlineBody {
  const insertSegments = insertBody.segments;
  if (insertSegments.length === 0) {
    return body;
  }

  const clampedOffset = Math.max(0, offset);
  let wire = 0;
  const result: ComposerInlineSegment[] = [];
  let inserted = false;

  const pushInsert = () => {
    if (inserted) {
      return;
    }
    result.push(...insertSegments);
    inserted = true;
  };

  for (const segment of body.segments) {
    const len = composerSegmentWireLength(segment);
    const start = wire;
    const end = wire + len;

    if (!inserted && clampedOffset <= start) {
      pushInsert();
    }

    if (
      !inserted &&
      segment.kind === "text" &&
      clampedOffset > start &&
      clampedOffset < end
    ) {
      const local = clampedOffset - start;
      const before = segment.text.slice(0, local);
      const after = segment.text.slice(local);
      if (before) {
        result.push({ ...segment, text: before });
      }
      pushInsert();
      if (after) {
        result.push({ id: nanoid(), kind: "text", text: after });
      }
      wire = end;
      continue;
    }

    wire = end;
    result.push(segment);
  }

  if (!inserted) {
    pushInsert();
  }

  return { segments: mergeAdjacentTextSegments(result) };
}

export function parseComposerInlineBody(
  value: unknown
): ComposerInlineBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.segments)) {
    return null;
  }
  const segments: ComposerInlineSegment[] = [];
  for (const entry of record.segments) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const segment = entry as Record<string, unknown>;
    if (segment.kind === "text" && typeof segment.text === "string") {
      segments.push({
        id: typeof segment.id === "string" ? segment.id : nanoid(),
        kind: "text",
        text: segment.text,
      });
      continue;
    }
    if (segment.kind === "connector") {
      const focus = parseComposerConnectorFocus(segment.focus);
      if (focus) {
        segments.push({
          focus,
          id: typeof segment.id === "string" ? segment.id : nanoid(),
          kind: "connector",
        });
      }
    }
  }
  if (segments.length === 0) {
    return emptyComposerInlineBody();
  }
  return { segments: mergeAdjacentTextSegments(segments) };
}

export function inlineBodyHasConnectorSegments(
  body: ComposerInlineBody | null | undefined
): boolean {
  return (
    body?.segments.some((segment) => segment.kind === "connector") ?? false
  );
}

export function messageHasStoredComposerDisplay(metadata?: {
  composerConnectorFocus?: unknown;
  composerConnectorFocuses?: unknown[];
  composerInlineBody?: unknown;
}): boolean {
  if (
    inlineBodyHasConnectorSegments(
      parseComposerInlineBody(metadata?.composerInlineBody)
    )
  ) {
    return true;
  }
  if (
    Array.isArray(metadata?.composerConnectorFocuses) &&
    metadata.composerConnectorFocuses.length > 0
  ) {
    return true;
  }
  if (metadata?.composerConnectorFocus) {
    return true;
  }
  return false;
}

export function inlineBodyFromWireAndFocuses(
  wire: string,
  focuses: ComposerConnectorFocus[]
): ComposerInlineBody | null {
  if (!wire.trim() || focuses.length === 0) {
    return null;
  }
  return inlineBodyFromPlainText(
    wire,
    focuses.map((focus) => ({
      focus,
      handle: connectorFocusMentionHandle(focus),
    }))
  );
}

export function resolveMessageInlineBody(args: {
  wireText: string;
  storedInlineBody?: unknown;
  focuses?: ComposerConnectorFocus[] | null;
  mentionTargets?: Array<{ handle: string; focus: ComposerConnectorFocus }>;
}): ComposerInlineBody | null {
  const parsed = parseComposerInlineBody(args.storedInlineBody);
  if (inlineBodyHasConnectorSegments(parsed)) {
    return parsed;
  }
  if (args.focuses?.length && args.wireText.includes("@")) {
    const rebuilt = inlineBodyFromWireAndFocuses(args.wireText, args.focuses);
    if (inlineBodyHasConnectorSegments(rebuilt)) {
      return rebuilt;
    }
  }
  if (args.mentionTargets?.length && args.wireText.includes("@")) {
    const rebuilt = inlineBodyFromPlainText(args.wireText, args.mentionTargets);
    if (inlineBodyHasConnectorSegments(rebuilt)) {
      return rebuilt;
    }
  }
  return parsed;
}
