"use client";

import type React from "react";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConnectorFocusInlineBadge } from "@/components/chat/connector-focus-inline-badge";
import type { ComposerInlineBody } from "@/lib/chat/composer-inline-body";
import {
  composerInlineStructureSignature,
  composerInlineWireSignature,
  composerInlineWireTextFromRoot,
  parseComposerEditableRoot,
  renderComposerEditableRoot,
  wireTextBeforeSelection,
} from "@/lib/chat/composer-inline-editable-dom";
import type { ActiveRoomMention } from "@/lib/chat/room-mention-autocomplete";
import { parseActiveRoomMention } from "@/lib/chat/room-mention-autocomplete";
import { cn } from "@/shared/utils";

export function ComposerInlineEditor({
  body,
  disabled = false,
  onActiveMentionChange,
  onBodyChange,
  onKeyDown,
  className,
  activeTextRef,
  containerRef,
  onPaste,
  onWireCursorChange,
  mentionHighlightClassName,
  scrollMirrorRef,
}: {
  body: ComposerInlineBody;
  disabled?: boolean;
  mentionHandles: Set<string>;
  onBodyChange: (body: ComposerInlineBody) => void;
  onActiveMentionChange: (args: {
    mention: ActiveRoomMention | null;
    textSegmentId: string | null;
  }) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
  activeTextRef?: RefObject<HTMLSpanElement | null>;
  activeTextSegmentId?: string | null;
  containerRef?: RefObject<HTMLDivElement | null>;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  onWireCursorChange?: (cursor: number) => void;
  mentionHighlightClassName?: string;
  scrollMirrorRef?: RefObject<HTMLDivElement | null>;
}) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const chipRootsRef = useRef<Map<string, Root>>(new Map());
  const structureRef = useRef("");
  const wireRef = useRef("");
  const skipNextStructureSyncRef = useRef(false);

  const reportWireCursor = useCallback(() => {
    const root = editableRef.current;
    if (!root) {
      return;
    }
    onWireCursorChange?.(wireTextBeforeSelection(root).length);
  }, [onWireCursorChange]);

  const mergeRefs = useCallback(
    (node: HTMLDivElement | null) => {
      editableRef.current = node;
      if (containerRef && "current" in containerRef) {
        (
          containerRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = node;
      }
      if (activeTextRef && "current" in activeTextRef) {
        (
          activeTextRef as React.MutableRefObject<HTMLSpanElement | null>
        ).current = node as unknown as HTMLSpanElement;
      }
    },
    [activeTextRef, containerRef]
  );

  const unmountChipRoots = useCallback(() => {
    for (const root of chipRootsRef.current.values()) {
      queueMicrotask(() => root.unmount());
    }
    chipRootsRef.current.clear();
  }, []);

  const createConnectorElement = useCallback(
    ({
      focus,
      segmentId,
    }: {
      focus: Parameters<typeof ConnectorFocusInlineBadge>[0]["focus"];
      segmentId: string;
    }) => {
      const el = document.createElement("span");
      el.className = "inline align-baseline leading-6";
      const root = createRoot(el);
      chipRootsRef.current.set(segmentId, root);
      root.render(
        <ConnectorFocusInlineBadge
          className="pointer-events-none"
          focus={focus}
          variant="composer"
        />
      );
      return el;
    },
    []
  );

  useLayoutEffect(() => {
    const root = editableRef.current;
    if (!root) {
      return;
    }
    const signature = composerInlineStructureSignature(body);
    const wire = composerInlineWireSignature(body);
    const domWire = composerInlineWireTextFromRoot(root);
    if (
      signature === structureRef.current &&
      wire === wireRef.current &&
      (document.activeElement === root || wire === domWire)
    ) {
      return;
    }
    if (
      skipNextStructureSyncRef.current &&
      signature === structureRef.current &&
      wire === domWire
    ) {
      skipNextStructureSyncRef.current = false;
      return;
    }
    skipNextStructureSyncRef.current = false;
    const hadFocus = document.activeElement === root;
    unmountChipRoots();
    renderComposerEditableRoot(root, body, createConnectorElement);
    structureRef.current = signature;
    wireRef.current = wire;
    if (hadFocus) {
      root.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(root);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [body, createConnectorElement, unmountChipRoots]);

  useEffect(() => unmountChipRoots, [unmountChipRoots]);

  const reportMention = useCallback(() => {
    const root = editableRef.current;
    if (!root) {
      return;
    }
    const before = wireTextBeforeSelection(root);
    const mention = parseActiveRoomMention(before, before.length);
    onActiveMentionChange({
      mention,
      textSegmentId: mention ? "root" : null,
    });
    reportWireCursor();
  }, [onActiveMentionChange, reportWireCursor]);

  const handleInput = useCallback(() => {
    const root = editableRef.current;
    if (!root) {
      return;
    }
    skipNextStructureSyncRef.current = true;
    const parsed = parseComposerEditableRoot(root);
    structureRef.current = composerInlineStructureSignature(parsed);
    wireRef.current = composerInlineWireSignature(parsed);
    onBodyChange(parsed);
    reportMention();
  }, [onBodyChange, reportMention]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: single contenteditable composer
    <div
      className={cn(
        "min-h-10 w-full cursor-text whitespace-pre-wrap break-words text-base leading-6 outline-none md:text-base",
        "[&_[data-composer-connector]]:m-0 [&_[data-composer-connector]]:inline [&_[data-composer-connector]]:align-baseline [&_[data-composer-connector]]:leading-6",
        disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-text",
        mentionHighlightClassName,
        className
      )}
      contentEditable={!disabled}
      data-testid="multimodal-input"
      onInput={handleInput}
      onKeyDown={(event) => {
        onKeyDown?.(event);
      }}
      onKeyUp={reportWireCursor}
      onMouseUp={reportMention}
      onPaste={onPaste}
      onScroll={(event) => {
        if (scrollMirrorRef?.current) {
          scrollMirrorRef.current.scrollTop = event.currentTarget.scrollTop;
        }
      }}
      ref={mergeRefs as Ref<HTMLDivElement>}
      role="textbox"
      suppressContentEditableWarning
      tabIndex={disabled ? -1 : 0}
    />
  );
}
