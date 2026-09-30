import { nanoid } from "nanoid";
import {
  type ComposerInlineBody,
  composerInlineWireText,
  inlineBodyFromPlainText,
  inlineBodyHasConnectorSegments,
  parseComposerInlineBody,
} from "@/lib/chat/composer-inline-body";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";

/** Private MIME so paste can restore connector chips inside our composer. */
export const COMPOSER_INLINE_CLIPBOARD_MIME =
  "application/x-kimiro-composer-inline-body+json";

export function cloneComposerInlineBodyWithFreshIds(
  body: ComposerInlineBody
): ComposerInlineBody {
  return {
    segments: body.segments.map((segment) =>
      segment.kind === "text"
        ? { ...segment, id: nanoid() }
        : { ...segment, id: nanoid() }
    ),
  };
}

export async function writeComposerInlineClipboard(args: {
  inlineBody: ComposerInlineBody;
}): Promise<void> {
  const wire = composerInlineWireText(args.inlineBody);
  const payload = JSON.stringify(args.inlineBody);

  if (typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([wire], { type: "text/plain" }),
          [COMPOSER_INLINE_CLIPBOARD_MIME]: new Blob([payload], {
            type: COMPOSER_INLINE_CLIPBOARD_MIME,
          }),
        }),
      ]);
      return;
    } catch {
      // Fall through to plain text (Safari / permission quirks).
    }
  }

  await navigator.clipboard.writeText(wire);
}

export function readComposerInlineBodyFromDataTransfer(
  data: DataTransfer
): ComposerInlineBody | null {
  const raw = data.getData(COMPOSER_INLINE_CLIPBOARD_MIME);
  if (raw) {
    try {
      const parsed = parseComposerInlineBody(JSON.parse(raw));
      if (parsed && inlineBodyHasConnectorSegments(parsed)) {
        return cloneComposerInlineBodyWithFreshIds(parsed);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function inlineBodyFromClipboardPlainText(args: {
  text: string;
  mentionTargets: Array<{ handle: string; focus: ComposerConnectorFocus }>;
}): ComposerInlineBody | null {
  const trimmed = args.text.trim();
  if (!trimmed) {
    return null;
  }
  const body = inlineBodyFromPlainText(trimmed, args.mentionTargets);
  if (!inlineBodyHasConnectorSegments(body)) {
    return null;
  }
  return cloneComposerInlineBodyWithFreshIds(body);
}
