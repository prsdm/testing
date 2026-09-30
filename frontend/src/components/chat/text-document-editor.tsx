"use client";

import { useEffect, useRef, useState } from "react";
import type { Suggestion } from "@/contracts/documents";
import {
  decodeDocxContentToMarkdown,
  encodeMarkdownAsDocxContent,
  isDocxStoredContent,
} from "@/shared/artifacts/text-docx";
import { DocumentSkeleton, InlineDocumentSkeleton } from "./document-skeleton";
import { Editor } from "./text-editor";

type TextDocumentEditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions?: Suggestion[];
  /** Compact loading state for chat preview cards. */
  compact?: boolean;
  /** View-only (chat preview / while the model is rewriting). */
  readOnly?: boolean;
};

export function TextDocumentEditor({
  content,
  onSaveContent,
  status,
  isCurrentVersion,
  currentVersionIndex,
  suggestions = [],
  compact = false,
  readOnly = false,
}: TextDocumentEditorProps) {
  const [markdown, setMarkdown] = useState(() =>
    isDocxStoredContent(content) ? "" : content
  );
  const [ready, setReady] = useState(() => !isDocxStoredContent(content));
  const lastEncodedRef = useRef<string | null>(null);
  const hasDisplayedRef = useRef(!isDocxStoredContent(content));

  useEffect(() => {
    let cancelled = false;

    if (content === lastEncodedRef.current) {
      return;
    }

    if (!isDocxStoredContent(content)) {
      setMarkdown(content);
      setReady(true);
      hasDisplayedRef.current = true;
      return;
    }

    // Avoid skeleton flash on updates — only skeleton on the first decode.
    if (!hasDisplayedRef.current) {
      setReady(false);
    }

    decodeDocxContentToMarkdown(content)
      .then((next) => {
        if (!cancelled) {
          setMarkdown(next);
          setReady(true);
          hasDisplayedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (!hasDisplayedRef.current) {
            setMarkdown("");
          }
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (!ready) {
    return compact ? (
      <InlineDocumentSkeleton />
    ) : (
      <DocumentSkeleton artifactKind="text" />
    );
  }

  const isLocked = readOnly || status === "streaming";

  return (
    <Editor
      content={markdown}
      currentVersionIndex={currentVersionIndex}
      isCurrentVersion={isCurrentVersion}
      onSaveContent={(updatedMarkdown, debounce) => {
        if (isLocked) {
          return;
        }
        setMarkdown(updatedMarkdown);
        encodeMarkdownAsDocxContent(updatedMarkdown)
          .then((stored) => {
            lastEncodedRef.current = stored;
            onSaveContent(stored, debounce);
          })
          .catch(() => undefined);
      }}
      readOnly={isLocked}
      status={status}
      suggestions={suggestions}
    />
  );
}
