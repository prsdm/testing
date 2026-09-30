"use client";

import { DownloadIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import type { Document } from "@/contracts/documents";
import { useArtifact } from "@/hooks/use-artifact";
import {
  codeDocumentFileName,
  downloadTextContent,
} from "@/shared/artifacts/download-document";
import {
  downloadSheetAsXlsx,
  sheetFileName,
} from "@/shared/artifacts/sheet-xlsx";
import {
  downloadTextAsDocx,
  textDocumentFileName,
} from "@/shared/artifacts/text-docx";
import { cn, fetcher } from "@/shared/utils";
import type { ArtifactKind } from "./artifact";
import { CodeEditor } from "./code-editor";
import { InlineDocumentSkeleton } from "./document-skeleton";
import {
  CodeIcon,
  FileIcon,
  FullscreenIcon,
  ImageIcon,
  LoaderIcon,
} from "./icons";
import { ImageEditor } from "./image-editor";
import { SpreadsheetEditor } from "./sheet-editor";
import { TextDocumentEditor } from "./text-document-editor";

type DocumentToolOutput = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content?: string;
};

type DocumentPreviewProps = {
  isReadonly: boolean;
  result?: Partial<DocumentToolOutput>;
  args?: Partial<DocumentToolOutput> & { isUpdate?: boolean };
};

function SheetKindIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      fill="none"
      height={16}
      viewBox="0 0 16 16"
      width={16}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Spreadsheet</title>
      <rect fill="#0F9D58" height="14" rx="2" width="14" x="1" y="1" />
      <path
        d="M4 5.5h8M4 8h8M4 10.5h8M6.5 4v8M9.5 4v8"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function previewFileName(kind: ArtifactKind | undefined, title: string) {
  if (kind === "sheet") {
    return sheetFileName(title || "Spreadsheet");
  }
  if (kind === "code") {
    return codeDocumentFileName(title || "code");
  }
  if (kind === "text") {
    return textDocumentFileName(title || "Document");
  }
  return title || "Document";
}

function createDownloadHandler(document: Document) {
  const content = document.content;
  if (!content) {
    return;
  }

  if (document.kind === "sheet") {
    return () => downloadSheetAsXlsx(document.title, content);
  }
  if (document.kind === "text") {
    return () => {
      downloadTextAsDocx(document.title, content).catch(() => undefined);
    };
  }
  if (document.kind === "code") {
    return () =>
      downloadTextContent(codeDocumentFileName(document.title), content);
  }
}

export function DocumentPreview({
  isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();

  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Document[]
  >(
    result?.id
      ? `${process.env.KIMIRO_BASE_PATH ?? ""}/api/document?id=${result.id}`
      : null,
    fetcher
  );

  const previewDocument = useMemo(() => {
    if (!Array.isArray(documents) || documents.length === 0) {
      return null;
    }
    return documents.at(-1) ?? null;
  }, [documents]);
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((currentArtifact) => ({
        ...currentArtifact,
        boundingBox: {
          height: boundingBox.height,
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  const openArtifact = useCallback(
    (event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      if (isReadonly) {
        toast.error(
          "Viewing files in shared chats is currently not supported."
        );
        return;
      }

      const target = event?.currentTarget ?? hitboxRef.current;
      if (!target) {
        return;
      }
      const boundingBox = target.getBoundingClientRect();
      setArtifact((current) => ({
        ...current,
        ...(result?.id && { documentId: result.id }),
        ...(result?.title && { title: result.title }),
        ...(result?.kind && { kind: result.kind }),
        boundingBox: {
          height: boundingBox.height,
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
        },
        isVisible: true,
      }));
    },
    [isReadonly, result, setArtifact]
  );

  if (!result?.id) {
    const kind = args?.kind ?? artifact.kind;
    const title = args?.title ?? artifact.title;
    return (
      <div className="w-full max-w-[480px]">
        <DocumentHeader
          isStreaming={true}
          kind={kind}
          onDownload={undefined}
          onExpand={undefined}
          title={previewFileName(kind, title || "Document")}
        />
        <div className="h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted p-6">
          {kind === "sheet" &&
          artifact.status === "streaming" &&
          artifact.content ? (
            <div className="pointer-events-none relative -m-6 size-[calc(100%+3rem)]">
              <div className="absolute inset-0">
                <SpreadsheetEditor
                  compact
                  content={artifact.content}
                  currentVersionIndex={0}
                  isCurrentVersion={true}
                  readOnly
                  saveContent={() => null}
                  sheetName={title || "Sheet1"}
                  status={artifact.status}
                />
              </div>
            </div>
          ) : kind === "text" &&
            artifact.status === "streaming" &&
            artifact.content ? (
            <div className="pointer-events-none">
              <TextDocumentEditor
                compact
                content={artifact.content}
                currentVersionIndex={0}
                isCurrentVersion={true}
                onSaveContent={() => null}
                readOnly
                status="streaming"
                suggestions={[]}
              />
            </div>
          ) : (
            <InlineDocumentSkeleton />
          )}
        </div>
      </div>
    );
  }

  if (isDocumentsFetching) {
    const kind = result?.kind ?? args?.kind ?? artifact.kind;
    const title = result?.title ?? args?.title ?? artifact.title;

    return (
      <div className="w-full max-w-[480px]">
        {title ? (
          <DocumentHeader
            isStreaming={true}
            kind={kind}
            onDownload={undefined}
            onExpand={undefined}
            title={previewFileName(kind, title)}
          />
        ) : (
          <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 bg-background px-3 py-2.5">
            <div className="flex flex-row items-center gap-2.5">
              <div className="size-4 animate-pulse rounded bg-muted-foreground/15" />
              <div className="h-3.5 w-28 animate-pulse rounded bg-muted-foreground/15" />
            </div>
            <div className="w-16" />
          </div>
        )}
        <div className="h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted p-6">
          <InlineDocumentSkeleton />
        </div>
      </div>
    );
  }

  const document: Document | null = previewDocument
    ? previewDocument
    : artifact.status === "streaming"
      ? {
          content: artifact.content,
          createdAt: new Date(),
          driveFileId: null,
          driveWebViewLink: null,
          id: artifact.documentId,
          kind: artifact.kind,
          title: artifact.title,
          userId: "noop",
        }
      : null;

  if (!document) {
    return (
      <LoadingSkeleton
        artifactKind={result?.kind ?? args?.kind ?? artifact.kind}
      />
    );
  }

  const headerTitle = previewFileName(document.kind, document.title);
  const onDownload = createDownloadHandler(document);

  return (
    <div className="relative w-full max-w-[480px]" ref={hitboxRef}>
      <DocumentHeader
        isStreaming={artifact.status === "streaming"}
        kind={document.kind}
        onDownload={onDownload}
        onExpand={openArtifact}
        title={headerTitle}
      />
      {/*
        Content is a real button so the card opens the artifact. Sheet tabs must
        not be nested <button>s — they use role="tab" instead.
      */}
      <button
        className="block w-full cursor-pointer text-left"
        onClick={openArtifact}
        type="button"
      >
        <DocumentContent document={document} />
      </button>
    </div>
  );
}

const LoadingSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => (
  <div className="w-full max-w-[480px]">
    <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 bg-background px-3 py-2.5">
      <div className="flex flex-row items-center gap-2.5">
        <div className="size-4 animate-pulse rounded bg-muted-foreground/15" />
        <div className="h-3.5 w-28 animate-pulse rounded bg-muted-foreground/15" />
      </div>
      <div className="w-16" />
    </div>
    {artifactKind === "image" ? (
      <div className="overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted">
        <div className="h-[257px] w-full animate-pulse bg-muted-foreground/10" />
      </div>
    ) : (
      <div className="h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 bg-muted p-6">
        <InlineDocumentSkeleton />
      </div>
    )}
  </div>
);

const PureDocumentHeader = ({
  title,
  kind,
  isStreaming,
  onDownload,
  onExpand,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
  onDownload?: () => void;
  onExpand?: (
    event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>
  ) => void;
}) => (
  <div className="flex flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-border/50 bg-background px-3 py-2">
    <div className="flex min-w-0 flex-row items-center gap-2.5">
      <div className="shrink-0 text-muted-foreground">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon size={14} />
          </div>
        ) : kind === "sheet" ? (
          <SheetKindIcon />
        ) : kind === "image" ? (
          <ImageIcon size={14} />
        ) : kind === "code" ? (
          <CodeIcon size={14} />
        ) : (
          <FileIcon size={14} />
        )}
      </div>
      <div className="truncate font-medium text-sm">{title}</div>
    </div>
    <div className="flex shrink-0 items-center gap-0.5">
      {onDownload ? (
        <Button
          aria-label={`Download ${title}`}
          className="text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onDownload();
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <DownloadIcon className="size-4" />
        </Button>
      ) : null}
      {onExpand ? (
        <Button
          aria-label={`Open ${title}`}
          className="text-muted-foreground"
          onClick={onExpand}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <FullscreenIcon size={16} />
        </Button>
      ) : (
        <div className="w-8" />
      )}
    </div>
  </div>
);

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) {
    return false;
  }
  if (prevProps.isStreaming !== nextProps.isStreaming) {
    return false;
  }
  if (prevProps.kind !== nextProps.kind) {
    return false;
  }
  if (Boolean(prevProps.onDownload) !== Boolean(nextProps.onDownload)) {
    return false;
  }
  if (Boolean(prevProps.onExpand) !== Boolean(nextProps.onExpand)) {
    return false;
  }

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact } = useArtifact();

  const containerClassName = cn(
    "h-[257px] overflow-hidden rounded-b-2xl border border-t-0 border-border/50 dark:bg-muted",
    {
      "p-0": document.kind === "code" || document.kind === "sheet",
      "p-4 sm:px-10 sm:py-10": document.kind === "text",
    }
  );

  const commonProps = {
    content: document.content ?? "",
    currentVersionIndex: 0,
    isCurrentVersion: true,
    saveContent: () => null,
    status: artifact.status,
    suggestions: [],
  };

  const handleSaveContent = () => null;

  return (
    <div className={cn(containerClassName, "relative")}>
      {document.kind === "text" ? (
        <TextDocumentEditor
          compact
          content={document.content ?? ""}
          currentVersionIndex={0}
          isCurrentVersion={true}
          onSaveContent={handleSaveContent}
          readOnly
          status={artifact.status}
          suggestions={[]}
        />
      ) : document.kind === "code" ? (
        <div className="relative flex w-full flex-1">
          <div className="absolute inset-0">
            <CodeEditor {...commonProps} onSaveContent={handleSaveContent} />
          </div>
        </div>
      ) : document.kind === "sheet" ? (
        <div className="relative flex size-full flex-1">
          <div className="absolute inset-0">
            <SpreadsheetEditor
              {...commonProps}
              compact
              readOnly
              sheetName={document.title}
            />
          </div>
        </div>
      ) : document.kind === "image" ? (
        <ImageEditor
          content={document.content ?? ""}
          currentVersionIndex={0}
          isCurrentVersion={true}
          isInline={true}
          status={artifact.status}
          title={document.title}
        />
      ) : null}
      {document.kind === "sheet" ? null : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-muted to-transparent dark:from-muted" />
      )}
      {document.kind === "code" && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-muted to-transparent dark:from-muted" />
      )}
    </div>
  );
};
