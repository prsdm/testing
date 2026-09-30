"use client";

import { exampleSetup } from "prosemirror-example-setup";
import { inputRules } from "prosemirror-inputrules";
import { EditorState } from "prosemirror-state";
import { type Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Suggestion } from "@/contracts/documents";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useArtifact } from "@/hooks/use-artifact";
import {
  documentSchema,
  handleTransaction,
  headingRule,
} from "@/lib/editor/config";
import {
  buildContentFromDocument,
  buildDocumentFromContent,
  createDecorations,
  documentMarkdownSerializer,
} from "@/lib/editor/functions";
import {
  projectWithPositions,
  suggestionsPlugin,
  suggestionsPluginKey,
  type UISuggestion,
} from "@/lib/editor/suggestions";
import { focusComposerInput } from "./composer-inject";
import { EditSelectionWithAi } from "./edit-selection-with-ai";
import { SuggestionDialog } from "./suggestion";

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Suggestion[];
  onSuggestionSelect?: (suggestion: UISuggestion | null) => void;
  onSuggestionApply?: () => void;
  activeSuggestion?: UISuggestion | null;
  /** When true, content is view-only (chat preview / mid-stream). */
  readOnly?: boolean;
};

type SelectionMenuState = {
  text: string;
  selectedText: string;
  top: number;
  left: number;
};

function PureEditor({
  content,
  onSaveContent,
  suggestions,
  status,
  readOnly = false,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<UISuggestion | null>(
    null
  );
  const suggestionsRef = useRef<UISuggestion[]>([]);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(
    null
  );
  const readOnlyRef = useRef(readOnly);
  const statusRef = useRef(status);
  const onSaveContentRef = useRef(onSaveContent);
  const syncSelectionMenuRef = useRef<(view: EditorView) => void>(
    () => undefined
  );
  const initialContentRef = useRef(content);
  const { setDocumentSelection } = useActiveChat();
  const { artifact } = useArtifact();

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    onSaveContentRef.current = onSaveContent;
  }, [onSaveContent]);

  const syncSelectionMenu = useCallback((view: EditorView) => {
    if (readOnlyRef.current || statusRef.current === "streaming") {
      setSelectionMenu(null);
      return;
    }

    const { from, to, empty } = view.state.selection;
    if (empty) {
      setSelectionMenu(null);
      return;
    }

    const text = view.state.doc.textBetween(from, to, "\n").trim();
    if (!text) {
      setSelectionMenu(null);
      return;
    }

    const selectedNode = view.state.doc.cut(from, to);
    const selectedText =
      documentMarkdownSerializer.serialize(selectedNode).trim() || text;

    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const top = Math.min(start.top, end.top);
    const left = Math.min(start.left, end.left);

    setSelectionMenu({
      left: Math.min(left, window.innerWidth - 160),
      selectedText,
      text,
      top,
    });
  }, []);

  useEffect(() => {
    syncSelectionMenuRef.current = syncSelectionMenu;
  }, [syncSelectionMenu]);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(initialContentRef.current),
        plugins: [
          ...exampleSetup({ menuBar: false, schema: documentSchema }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
          suggestionsPlugin,
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        dispatchTransaction: (transaction) => {
          handleTransaction({
            editorRef,
            onSaveContent: (updatedContent, debounce) => {
              onSaveContentRef.current(updatedContent, debounce);
            },
            transaction,
          });
          if (editorRef.current && transaction.selectionSet) {
            syncSelectionMenuRef.current(editorRef.current);
          }
        },
        editable: () => !readOnlyRef.current,
        handleDOMEvents: {
          click(_view, event) {
            const target = event.target as HTMLElement;
            const highlight = target.closest(".suggestion-highlight");
            if (highlight) {
              const id = highlight.getAttribute("data-suggestion-id");
              const found = suggestionsRef.current.find((s) => s.id === id);
              if (found) {
                setActiveSuggestion(found);
              }
              return true;
            }
            return false;
          },
          keyup(view) {
            syncSelectionMenuRef.current(view);
            return false;
          },
          mouseup(view) {
            syncSelectionMenuRef.current(view);
            return false;
          },
        },
        state,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // Mount once — content sync is handled below. Remounting on every
    // content change steals focus and breaks typing.
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        editable: () => !readOnly,
      });
    }
    if (readOnly || status === "streaming") {
      setSelectionMenu(null);
    }
  }, [readOnly, status]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        dispatchTransaction: (transaction) => {
          handleTransaction({
            editorRef,
            onSaveContent,
            transaction,
          });
          if (editorRef.current && transaction.selectionSet) {
            syncSelectionMenu(editorRef.current);
          }
        },
      });
    }
  }, [onSaveContent, syncSelectionMenu]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromDocument(
        editorRef.current.state.doc
      );

      if (status === "streaming") {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content
        );

        transaction.setMeta("no-save", true);
        editorRef.current.dispatch(transaction);
        setSelectionMenu(null);
        return;
      }

      if (currentContent !== content) {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content
        );

        transaction.setMeta("no-save", true);
        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  useEffect(() => {
    if (editorRef.current?.state.doc && content) {
      const projectedSuggestions = projectWithPositions(
        editorRef.current.state.doc,
        suggestions
      ).filter(
        (suggestion) => suggestion.selectionStart && suggestion.selectionEnd
      );

      suggestionsRef.current = projectedSuggestions;

      const decorations = createDecorations(
        projectedSuggestions,
        editorRef.current
      );

      const transaction = editorRef.current.state.tr;
      transaction.setMeta(suggestionsPluginKey, { decorations });
      editorRef.current.dispatch(transaction);
    }
  }, [suggestions, content]);

  const handleApply = useCallback(() => {
    if (!editorRef.current || !activeSuggestion) {
      return;
    }

    const { state, dispatch } = editorRef.current;
    const currentState = suggestionsPluginKey.getState(state);
    const currentDecorations = currentState?.decorations;

    if (currentDecorations) {
      const newDecorations = DecorationSet.create(
        state.doc,
        currentDecorations
          .find()
          .filter(
            (decoration: Decoration) =>
              decoration.spec.suggestionId !== activeSuggestion.id
          )
      );

      const decorationTransaction = state.tr;
      decorationTransaction.setMeta(suggestionsPluginKey, {
        decorations: newDecorations,
        selected: null,
      });
      dispatch(decorationTransaction);
    }

    const textTransaction = editorRef.current.state.tr.replaceWith(
      activeSuggestion.selectionStart,
      activeSuggestion.selectionEnd,
      state.schema.text(activeSuggestion.suggestedText)
    );
    textTransaction.setMeta("no-debounce", true);
    dispatch(textTransaction);

    setActiveSuggestion(null);
  }, [activeSuggestion]);

  const handleEditSelectionWithAi = useCallback(() => {
    if (!selectionMenu?.text) {
      return;
    }
    if (!artifact.documentId || artifact.documentId === "init") {
      return;
    }
    setDocumentSelection({
      documentId: artifact.documentId,
      selectedText: selectionMenu.selectedText,
      text: selectionMenu.text,
      title: artifact.title || "Document",
    });
    focusComposerInput();
    setSelectionMenu(null);
  }, [
    selectionMenu,
    setDocumentSelection,
    artifact.documentId,
    artifact.title,
  ]);

  return (
    <>
      <div
        className="prose dark:prose-invert prose-neutral relative max-w-none whitespace-pre-wrap"
        ref={containerRef}
      />
      {selectionMenu && !readOnly && status !== "streaming"
        ? createPortal(
            <EditSelectionWithAi
              left={selectionMenu.left}
              onEdit={handleEditSelectionWithAi}
              top={selectionMenu.top}
            />,
            document.body
          )
        : null}
      {activeSuggestion &&
        containerRef.current?.closest("[data-slot='artifact-content']") &&
        createPortal(
          <SuggestionDialog
            onApply={handleApply}
            onClose={() => setActiveSuggestion(null)}
            suggestion={activeSuggestion}
          />,
          containerRef.current.closest(
            "[data-slot='artifact-content']"
          ) as HTMLElement
        )}
    </>
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    prevProps.readOnly === nextProps.readOnly &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent
  );
}

export const Editor = memo(PureEditor, areEqual);
