import { formatDistance } from "date-fns";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { useWindowSize } from "usehooks-ts";
import { codeArtifact } from "@/artifacts/code/client";
import { imageArtifact } from "@/artifacts/image/client";
import { sheetArtifact } from "@/artifacts/sheet/client";
import { textArtifact } from "@/artifacts/text/client";
import type { ArtifactKind } from "@/contracts/artifact";
import type { Document } from "@/contracts/documents";
import type { MessageReaction } from "@/contracts/message-reactions";
import { useArtifact } from "@/hooks/use-artifact";
import type {
  ChatHelpers,
  ChatRunStatus,
  ChatSendMessage,
  ChatSetMessages,
} from "@/lib/chat/chat-helpers";
import type { Attachment, ChatMessage } from "@/shared/types";
import { fetcher } from "@/shared/utils";
import { useSidebar } from "../ui/sidebar";
import { ArtifactActions } from "./artifact-actions";
import { ArtifactCloseButton } from "./artifact-close-button";
import { LoaderIcon } from "./icons";
import { Toolbar } from "./toolbar";
import { VersionFooter } from "./version-footer";
export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
];
export type { ArtifactKind } from "@/contracts/artifact";

export type UIArtifact = {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: "streaming" | "idle";
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
};

function PureArtifact({
  chatId: _chatId,
  input: _input,
  setInput: _setInput,
  status,
  stop,
  attachments: _attachments,
  setAttachments: _setAttachments,
  sendMessage,
  messages: _messages,
  setMessages,
  regenerate: _regenerate,
  messageReactions: _messageReactions,
  isReadonly: _isReadonly,
  selectedModelId: _selectedModelId,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: ChatRunStatus;
  stop: ChatHelpers["stop"];
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: ChatMessage[];
  setMessages: ChatSetMessages;
  messageReactions: MessageReaction[] | undefined;
  sendMessage: ChatSendMessage;
  regenerate: ChatHelpers["regenerate"];
  isReadonly: boolean;
  selectedModelId: string;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Document[]>(
    artifact.documentId !== "init" && artifact.status !== "streaming"
      ? `${process.env.KIMIRO_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}`
      : null,
    fetcher
  );

  const [mode, setMode] = useState<"edit" | "diff">("edit");
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  /** Manual edits update content in place (same createdAt) — track save time in UI. */
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const { state: sidebarState } = useSidebar();
  const artifactContentRef = useRef<HTMLDivElement>(null);
  const artifactPanelRef = useRef<HTMLDivElement>(null);
  const userScrolledArtifact = useRef(false);
  const [isContentDirty, setIsContentDirty] = useState(false);

  useEffect(() => {
    if (artifact.status !== "streaming") {
      userScrolledArtifact.current = false;
      return;
    }
    if (userScrolledArtifact.current) {
      return;
    }
    const el = artifactContentRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight });
  }, [artifact.status]);

  useEffect(() => {
    if (Array.isArray(documents) && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        if (!isContentDirty) {
          const fromDoc = new Date(mostRecentDocument.createdAt);
          setLastSavedAt((prev) => {
            if (!prev) {
              return fromDoc;
            }
            return prev.getTime() >= fromDoc.getTime() ? prev : fromDoc;
          });
        }
        if (artifact.status === "streaming" || !isContentDirty) {
          setArtifact((currentArtifact) => ({
            ...currentArtifact,
            content: mostRecentDocument.content ?? "",
          }));
        }
      }
    }
  }, [documents, setArtifact, artifact.status, isContentDirty]);

  useEffect(() => {
    mutateDocuments();
  }, [mutateDocuments]);

  // Refresh relative "Updated … ago" labels while the panel is open.
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Reset local save clock when switching documents.
  useEffect(() => {
    if (artifact.documentId) {
      setLastSavedAt(null);
    }
  }, [artifact.documentId]);

  const { mutate } = useSWRConfig();

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) {
        return;
      }

      mutate<Document[]>(
        `${process.env.KIMIRO_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}`,
        async (currentDocuments) => {
          if (
            !(Array.isArray(currentDocuments) && currentDocuments.length > 0)
          ) {
            return Array.isArray(currentDocuments) ? currentDocuments : [];
          }

          const currentDocument = currentDocuments.at(-1);

          if (!currentDocument?.content) {
            setIsContentDirty(false);
            return currentDocuments;
          }

          if (currentDocument.content === updatedContent) {
            setIsContentDirty(false);
            return currentDocuments;
          }

          await fetch(
            `${process.env.KIMIRO_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}`,
            {
              body: JSON.stringify({
                content: updatedContent,
                isManualEdit: true,
                kind: artifact.kind,
                title: artifact.title,
              }),
              method: "POST",
            }
          );

          const savedAt = new Date();
          setLastSavedAt(savedAt);
          setIsContentDirty(false);

          return currentDocuments.map((doc, i) =>
            i === currentDocuments.length - 1
              ? { ...doc, content: updatedContent }
              : doc
          );
        },
        { revalidate: false }
      );
    },
    [artifact, mutate]
  );

  const latestContentRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      latestContentRef.current = updatedContent;
      setIsContentDirty(true);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (debounce) {
        saveTimerRef.current = setTimeout(() => {
          handleContentChange(latestContentRef.current);
          saveTimerRef.current = null;
        }, 2000);
      } else {
        handleContentChange(updatedContent);
      }
    },
    [handleContentChange]
  );

  function getDocumentContentById(index: number) {
    if (!documents) {
      return "";
    }
    if (!documents[index]) {
      return "";
    }
    return documents[index].content ?? "";
  }

  const handleVersionChange = (type: "next" | "prev" | "toggle" | "latest") => {
    if (!documents) {
      return;
    }

    if (type === "latest") {
      setCurrentVersionIndex(documents.length - 1);
      setMode("edit");
    }

    if (type === "toggle") {
      setMode((currentMode) => (currentMode === "edit" ? "diff" : "edit"));
    }

    if (type === "prev") {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === "next" && currentVersionIndex < documents.length - 1) {
      setCurrentVersionIndex((index) => index + 1);
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  useEffect(() => {
    if (artifact.documentId !== "init" && artifactDefinition.initialize) {
      artifactDefinition.initialize({
        documentId: artifact.documentId,
        setMetadata,
      });
    }
  }, [artifact.documentId, artifactDefinition, setMetadata]);

  if (!artifact.isVisible && !isMobile) {
    return (
      <div
        className="h-dvh w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        data-testid="artifact"
      />
    );
  }

  if (!artifact.isVisible) {
    return null;
  }

  const consoleError =
    metadata?.outputs
      ?.filter((o: { status: string }) => o.status === "failed")
      .flatMap((o: { contents: { type: string; value: string }[] }) =>
        o.contents.filter((c) => c.type === "text").map((c) => c.value)
      )
      .join("\n") || undefined;

  const artifactPanel = (
    <>
      {sidebarState !== "collapsed" && (
        <div className="flex h-[calc(3.5rem+1px)] shrink-0 items-center justify-between border-b border-border/50 px-4">
          <div className="flex items-center gap-3">
            <ArtifactCloseButton />
            <div className="flex flex-col gap-0.5">
              <div className="text-sm font-semibold leading-tight tracking-tight">
                {artifact.title}
              </div>
              <div className="flex items-center gap-2">
                {document?.driveFileId ? (
                  <div className="text-xs text-muted-foreground">
                    {document.driveWebViewLink ? (
                      <a
                        className="hover:text-foreground hover:underline"
                        href={document.driveWebViewLink}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Linked to Drive
                      </a>
                    ) : (
                      "Linked to Drive"
                    )}
                  </div>
                ) : null}
                {isContentDirty ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                    Saving...
                  </div>
                ) : document ? (
                  <div className="text-xs text-muted-foreground">
                    {`Updated ${formatDistance(
                      lastSavedAt ?? new Date(document.createdAt),
                      new Date(nowTick),
                      { addSuffix: true }
                    )}`}
                  </div>
                ) : artifact.status === "streaming" ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="animate-spin">
                      <LoaderIcon size={12} />
                    </div>
                    Generating...
                  </div>
                ) : (
                  <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/10" />
                )}
                {documents && documents.length > 1 && (
                  <div className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    v{currentVersionIndex + 1}/{documents.length}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-background"
          data-slot="artifact-content"
          onScroll={() => {
            const el = artifactContentRef.current;
            if (!el) {
              return;
            }
            const atBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            userScrolledArtifact.current = !atBottom;
          }}
          ref={artifactContentRef}
        >
          <artifactDefinition.content
            content={
              isCurrentVersion
                ? artifact.content
                : getDocumentContentById(currentVersionIndex)
            }
            currentVersionIndex={currentVersionIndex}
            getDocumentContentById={getDocumentContentById}
            isCurrentVersion={isCurrentVersion}
            isInline={false}
            isLoading={isDocumentsFetching && !artifact.content}
            metadata={metadata}
            mode={mode}
            onSaveContent={saveContent}
            setMetadata={setMetadata}
            status={artifact.status}
            suggestions={[]}
            title={artifact.title}
          />
        </div>
        <AnimatePresence>
          {isCurrentVersion && (
            <Toolbar
              artifactActions={
                <ArtifactActions
                  artifact={artifact}
                  currentVersionIndex={currentVersionIndex}
                  handleVersionChange={handleVersionChange}
                  isCurrentVersion={isCurrentVersion}
                  metadata={metadata}
                  mode={mode}
                  setMetadata={setMetadata}
                />
              }
              artifactInteractBoundaryRef={artifactPanelRef}
              artifactKind={artifact.kind}
              consoleError={consoleError}
              documentId={artifact.documentId}
              isToolbarVisible={isToolbarVisible}
              onClose={() => {
                setArtifact((prev) => ({ ...prev, isVisible: false }));
              }}
              sendMessage={sendMessage}
              setIsToolbarVisible={setIsToolbarVisible}
              setMessages={setMessages}
              status={status}
              stop={stop}
            />
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {!isCurrentVersion && (
          <VersionFooter
            currentVersionIndex={currentVersionIndex}
            documents={documents}
            handleVersionChange={handleVersionChange}
            mode={mode}
            setMode={setMode}
          />
        )}
      </AnimatePresence>
    </>
  );

  if (isMobile) {
    return (
      <motion.div
        animate={{
          borderRadius: 0,
          height: windowHeight,
          opacity: 1,
          width: "100dvw",
          x: 0,
          y: 0,
        }}
        className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-sidebar"
        data-testid="artifact"
        exit={{ opacity: 0, scale: 0.95 }}
        initial={{
          borderRadius: 50,
          height: artifact.boundingBox.height,
          opacity: 1,
          width: artifact.boundingBox.width,
          x: artifact.boundingBox.left,
          y: artifact.boundingBox.top,
        }}
        ref={artifactPanelRef}
        transition={{ damping: 30, stiffness: 300, type: "spring" }}
      >
        {artifactPanel}
      </motion.div>
    );
  }

  return (
    <div
      className="relative flex h-dvh w-[60%] shrink-0 flex-col overflow-hidden border-l border-border/50 bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      data-testid="artifact"
      ref={artifactPanelRef}
    >
      {artifactPanel}
    </div>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (!equal(prevProps.messageReactions, nextProps.messageReactions)) {
    return false;
  }
  if (prevProps.input !== nextProps.input) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }

  return true;
});
