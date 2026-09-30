"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/chat/create-artifact";
import { DiffView } from "@/components/chat/diffview";
import { DocumentSkeleton } from "@/components/chat/document-skeleton";
import {
  ClockRewind,
  CopyIcon,
  DownloadIcon,
  MessageIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
  UploadIcon,
} from "@/components/chat/icons";
import { TextDocumentEditor } from "@/components/chat/text-document-editor";
import type { Suggestion } from "@/contracts/documents";
import { exportArtifactToDrive } from "@/lib/artifacts/export-artifact-to-drive";
import { fetchDocumentSuggestions } from "@/lib/chat/fetch-document-suggestions";
import {
  decodeDocxContentToMarkdown,
  downloadTextAsDocx,
  isDocxStoredContent,
} from "@/shared/artifacts/text-docx";

type TextArtifactMetadata = {
  suggestions: Suggestion[];
};

function TextDiffView({
  currentVersionIndex,
  getDocumentContentById,
}: {
  currentVersionIndex: number;
  getDocumentContentById: (index: number) => string;
}) {
  const [oldContent, setOldContent] = useState("");
  const [newContent, setNewContent] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const selectedContent = getDocumentContentById(currentVersionIndex);
    const prevContent =
      currentVersionIndex > 0
        ? getDocumentContentById(currentVersionIndex - 1)
        : selectedContent;

    setReady(false);
    Promise.all([
      decodeDocxContentToMarkdown(prevContent),
      decodeDocxContentToMarkdown(selectedContent),
    ])
      .then(([oldMarkdown, newMarkdown]) => {
        if (!cancelled) {
          setOldContent(oldMarkdown);
          setNewContent(newMarkdown);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOldContent("");
          setNewContent("");
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentVersionIndex, getDocumentContentById]);

  if (!ready) {
    return <DocumentSkeleton artifactKind="text" />;
  }

  return (
    <div className="flex flex-row px-4 py-8 md:px-16 md:py-12 lg:px-20">
      <DiffView newContent={newContent} oldContent={oldContent} />
    </div>
  );
}

export const textArtifact = new Artifact<"text", TextArtifactMetadata>({
  actions: [
    {
      description: "View changes",
      icon: <ClockRewind size={18} />,
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("toggle");
      },
    },
    {
      description: "View Previous version",
      icon: <UndoIcon size={18} />,
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
    },
    {
      description: "View Next version",
      icon: <RedoIcon size={18} />,
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
    },
    {
      description: "Download as .docx",
      icon: <DownloadIcon size={18} />,
      onClick: ({ title, content }) => {
        downloadTextAsDocx(title || "Document", content)
          .then(() => toast.success("Downloaded .docx"))
          .catch(() => toast.error("Failed to download document"));
      },
    },
    {
      description: "Save to Google Drive",
      icon: <UploadIcon size={18} />,
      isDisabled: ({ content }) => !content.trim(),
      onClick: async ({ title, content, tenantSlug }) => {
        try {
          const uploaded = await exportArtifactToDrive({
            content,
            kind: "text",
            tenantSlug,
            title: title || "Document",
          });
          if (uploaded.webViewLink) {
            toast.success("Saved to Google Drive", {
              action: {
                label: "Open",
                onClick: () => {
                  window.open(uploaded.webViewLink, "_blank", "noopener");
                },
              },
            });
            return;
          }
          toast.success(`Saved to Google Drive as ${uploaded.name}`);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save to Google Drive"
          );
        }
      },
    },
    {
      description: "Copy to clipboard",
      icon: <CopyIcon size={18} />,
      onClick: ({ content }) => {
        decodeDocxContentToMarkdown(content)
          .then((markdown) => {
            navigator.clipboard.writeText(markdown);
            toast.success("Copied to clipboard!");
          })
          .catch(() => toast.error("Failed to copy document"));
      },
    },
  ],
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    if (mode === "diff") {
      return (
        <TextDiffView
          currentVersionIndex={currentVersionIndex}
          getDocumentContentById={getDocumentContentById}
        />
      );
    }

    return (
      <div className="flex flex-row px-4 py-8 md:px-16 md:py-12 lg:px-20">
        <TextDocumentEditor
          content={content}
          currentVersionIndex={currentVersionIndex}
          isCurrentVersion={isCurrentVersion}
          onSaveContent={onSaveContent}
          status={status}
          suggestions={isCurrentVersion && metadata ? metadata.suggestions : []}
        />

        {metadata?.suggestions && metadata.suggestions.length > 0 ? (
          <div className="h-dvh w-12 shrink-0 md:hidden" />
        ) : null}
      </div>
    );
  },
  description: "Useful for text content, like drafting essays and emails.",
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await fetchDocumentSuggestions(documentId);

    setMetadata({
      suggestions,
    });
  },
  kind: "text",
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === "data-suggestion") {
      setMetadata((metadata) => ({
        suggestions: [...metadata.suggestions, streamPart.data],
      }));
    }

    if (streamPart.type === "data-textDelta") {
      setArtifact((draftArtifact) => {
        const nextContent = isDocxStoredContent(streamPart.data)
          ? streamPart.data
          : draftArtifact.content + streamPart.data;

        return {
          ...draftArtifact,
          content: nextContent,
          isVisible:
            draftArtifact.status === "streaming" &&
            draftArtifact.content.length > 400 &&
            draftArtifact.content.length < 450
              ? true
              : draftArtifact.isVisible,
          status: "streaming",
        };
      });
    }
  },
  toolbar: [
    {
      description: "Add final polish",
      icon: <PenIcon />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          parts: [
            {
              text: "Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
    {
      description: "Request suggestions",
      icon: <MessageIcon />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          parts: [
            {
              text: "Please add suggestions you have that could improve the writing.",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
  ],
});
