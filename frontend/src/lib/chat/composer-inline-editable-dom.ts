import { nanoid } from "nanoid";
import type {
  ComposerInlineBody,
  ComposerInlineSegment,
} from "@/lib/chat/composer-inline-body";
import {
  composerInlineWireText,
  mergeAdjacentTextSegments,
} from "@/lib/chat/composer-inline-body";
import type { ActiveRoomMention } from "@/lib/chat/room-mention-autocomplete";
import { parseActiveRoomMention } from "@/lib/chat/room-mention-autocomplete";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import {
  connectorFocusMentionToken,
  parseComposerConnectorFocus,
} from "@/shared/connectors/composer-connector-focus";

const CONNECTOR_ATTR = "data-composer-connector";

/** Connector layout only — text edits sync via DOM input, not re-mount. */
export function composerInlineStructureSignature(body: ComposerInlineBody) {
  return body.segments
    .map((segment, index) =>
      segment.kind === "connector"
        ? `c:${index}:${JSON.stringify(segment.focus)}`
        : `t:${index}`
    )
    .join("|");
}

export function composerInlineWireSignature(body: ComposerInlineBody) {
  return composerInlineWireText(body);
}

function appendParsedTextSegment(
  segments: ComposerInlineSegment[],
  text: string
) {
  if (!text) {
    return;
  }
  const previous = segments.at(-1);
  if (previous?.kind === "text") {
    previous.text += text;
    return;
  }
  segments.push({ id: nanoid(), kind: "text", text });
}

function parseEditableNode(
  node: Node,
  segments: ComposerInlineSegment[]
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    appendParsedTextSegment(segments, node.textContent ?? "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const element = node as HTMLElement;
  if (element.tagName === "BR") {
    appendParsedTextSegment(segments, "\n");
    return;
  }
  const rawFocus = element.getAttribute(CONNECTOR_ATTR);
  if (rawFocus) {
    try {
      const focus = parseComposerConnectorFocus(JSON.parse(rawFocus));
      if (focus) {
        segments.push({
          focus,
          id: element.getAttribute("data-segment-id") ?? nanoid(),
          kind: "connector",
        });
      }
    } catch {
      // ignore malformed
    }
    return;
  }
  for (const child of element.childNodes) {
    parseEditableNode(child, segments);
  }
}

export function parseComposerEditableRoot(
  root: HTMLElement
): ComposerInlineBody {
  const segments: ComposerInlineSegment[] = [];
  for (const node of root.childNodes) {
    parseEditableNode(node, segments);
  }
  if (segments.length === 0) {
    return {
      segments: [{ id: nanoid(), kind: "text", text: "" }],
    };
  }
  return { segments: mergeAdjacentTextSegments(segments) };
}

export function renderComposerEditableRoot(
  root: HTMLElement,
  body: ComposerInlineBody,
  createConnectorElement: (args: {
    focus: ComposerConnectorFocus;
    segmentId: string;
  }) => HTMLElement
) {
  root.replaceChildren();
  for (const segment of body.segments) {
    if (segment.kind === "text") {
      root.append(document.createTextNode(segment.text));
      continue;
    }
    const chip = createConnectorElement({
      focus: segment.focus,
      segmentId: segment.id,
    });
    chip.setAttribute(CONNECTOR_ATTR, JSON.stringify(segment.focus));
    chip.setAttribute("data-segment-id", segment.id);
    chip.contentEditable = "false";
    root.append(chip);
  }
  if (root.childNodes.length === 0) {
    root.append(document.createTextNode(""));
  }
}

/** Text before caret using the same encoding as {@link composerInlineWireText}. */
export function wireTextBeforeSelection(root: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return composerInlineWireTextFromRoot(root);
  }
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) {
    return composerInlineWireTextFromRoot(root);
  }
  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  const fragment = prefix.cloneContents();
  return wireTextFromFragment(fragment);
}

export function composerInlineWireTextFromRoot(root: HTMLElement): string {
  return wireTextFromFragment(root);
}

function wireTextFromFragment(root: ParentNode | DocumentFragment): string {
  let out = "";
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    const element = node as HTMLElement;
    if (element.tagName === "BR") {
      out += "\n";
      continue;
    }
    const rawFocus = element.getAttribute(CONNECTOR_ATTR);
    if (rawFocus) {
      try {
        const focus = parseComposerConnectorFocus(JSON.parse(rawFocus));
        if (focus) {
          out += connectorFocusMentionToken(focus);
        }
      } catch {
        // ignore
      }
      continue;
    }
    out += wireTextFromFragment(element);
  }
  return out;
}

export function resolveActiveMentionInEditable(
  root: HTMLElement
): ActiveRoomMention | null {
  const before = wireTextBeforeSelection(root);
  return parseActiveRoomMention(before, before.length);
}
