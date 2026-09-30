"use client";

import {
  FileIcon,
  Loader2Icon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import type { ArtifactKind } from "@/components/chat/artifact";
import {
  type ConnectorProvider,
  ConnectorProviderIcon,
} from "@/components/connectors/connector-provider-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useArtifact } from "@/hooks/use-artifact";
import {
  GOOGLE_DOC_MIME,
  GOOGLE_SHEET_MIME,
  isDriveChatAttachableMime,
} from "@/shared/artifacts/drive-import";
import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";
import { googleAppOAuthConnectPath } from "@/shared/connectors/providers/google-shared/connect-url";
import type { Attachment } from "@/shared/types";
import { cn } from "@/shared/utils";

type DriveFileRow = {
  fileId: string;
  title: string;
  mimeType: string;
  link: string;
  modifiedTime?: string;
};

type ImportedArtifactPayload = {
  id: string;
  title: string;
  kind: ArtifactKind;
};

function openImportedArtifact(args: {
  payload: ImportedArtifactPayload;
  setArtifact: ReturnType<typeof useArtifact>["setArtifact"];
  mutate: ReturnType<typeof useSWRConfig>["mutate"];
}) {
  return args.mutate(`/api/document?id=${args.payload.id}`).then(() => {
    args.setArtifact({
      boundingBox: {
        height: 0,
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        width: 0,
      },
      content: "",
      documentId: args.payload.id,
      isVisible: true,
      kind: args.payload.kind,
      status: "idle",
      title: args.payload.title,
    });
  });
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    code?: string;
    error?: string;
  } | null;
  if (payload?.code === "REAUTH_REQUIRED") {
    window.location.assign("/login?reason=reauth");
    return "Re-authentication required.";
  }
  return payload?.error ?? "Request failed.";
}

/** Only treat true “not linked” as Connect. Scope problems refresh silently. */
function classifyConnectorBrowseError(
  message: string
): "connect" | "reconnect" | "error" {
  const lower = message.toLowerCase();
  if (
    lower.includes("on the connectors page first") ||
    lower.includes("account is not connected") ||
    lower.includes("is not connected") ||
    (lower.includes("connect ") && lower.includes(" first"))
  ) {
    return "connect";
  }
  if (
    lower.includes("insufficient") ||
    lower.includes("permissions need updating") ||
    lower.includes("invalid_grant") ||
    lower.includes("scope")
  ) {
    return "reconnect";
  }
  return "error";
}

const REAUTH_LOCK_KEY = "kimiro:connector-reauth";

/** Silent OAuth refresh (no forceConsent/revoke). Prevents redirect loops. */
function beginSilentGoogleRefresh(href: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(REAUTH_LOCK_KEY) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < 90_000) {
      return false;
    }
    sessionStorage.setItem(REAUTH_LOCK_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  window.location.assign(href);
  return true;
}

function clearAutomaticReauthLock() {
  try {
    sessionStorage.removeItem(REAUTH_LOCK_KEY);
  } catch {
    // ignore
  }
}

function currentAppReturnTo() {
  return `${window.location.pathname}${window.location.search}` || "/chat";
}

function tenantSlugFromBrowsePath(browsePath: string): string | null {
  const match = browsePath.match(/^\/api\/sources\/([^/]+)\//);
  return match?.[1] ?? null;
}

function mimeLabel(mimeType: string) {
  if (mimeType === GOOGLE_DOC_MIME || mimeType === DOCX_DRIVE_MIME) {
    return "Doc";
  }
  if (mimeType === GOOGLE_SHEET_MIME || mimeType === XLSX_DRIVE_MIME) {
    return "Sheet";
  }
  if (mimeType === "application/pdf") {
    return "PDF";
  }
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return "Text";
  }
  if (mimeType.startsWith("image/")) {
    return "Image";
  }
  return "File";
}

function CloudAttachBrowsePanel({
  source,
  onDone,
  onAttached,
}: {
  source: {
    id: string;
    label: string;
    provider: ConnectorProvider;
    browsePath: string;
    attachPath: string;
    connectHref: string;
    pageTokenParam: "pageToken" | "from" | "start";
    /** When set, filter browse results client-side (Drive returns mixed files). */
    filterMime?: (mimeType: string) => boolean;
    searchPlaceholder: string;
    emptyCopy: string;
    connectCopy: string;
    reconnectCopy: string;
  };
  onDone: () => void;
  onAttached: (attachment: Attachment) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [files, setFiles] = useState<DriveFileRow[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [importingFileId, setImportingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectorGate, setConnectorGate] = useState<
    "connect" | "reconnect" | null
  >(null);
  const activeRequestIdRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadFiles = useCallback(
    async (args: { append?: boolean; pageToken?: string } = {}) => {
      activeAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);
      setConnectorGate(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) {
          params.set("q", debouncedSearch);
        }
        if (args.pageToken) {
          params.set(source.pageTokenParam, args.pageToken);
        }
        params.set("_ts", String(Date.now()));
        const response = await fetch(
          `${source.browsePath}?${params.toString()}`,
          {
            cache: "no-store",
            signal: abortController.signal,
          }
        );
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        if (!response.ok) {
          const message = await readApiError(response);
          const gate = classifyConnectorBrowseError(message);
          if (gate === "reconnect" && source.provider === "google-drive") {
            const tenantSlug = tenantSlugFromBrowsePath(source.browsePath);
            const started =
              tenantSlug != null &&
              beginSilentGoogleRefresh(
                googleAppOAuthConnectPath(tenantSlug, "google-drive", {
                  returnTo: currentAppReturnTo(),
                })
              );
            if (started) {
              setConnectorGate("reconnect");
              setError("Refreshing Google Drive access…");
              return;
            }
          }
          if (gate === "connect") {
            setConnectorGate("connect");
          }
          setError(message);
          return;
        }
        clearAutomaticReauthLock();
        const data = (await response.json()) as {
          files: DriveFileRow[];
          nextPageToken?: string;
        };
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        const filtered = source.filterMime
          ? data.files.filter((file) => source.filterMime?.(file.mimeType))
          : data.files;
        setFiles((current) =>
          args.append ? [...current, ...filtered] : filtered
        );
        setNextPageToken(data.nextPageToken);
      } catch (loadError) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : `Failed to load ${source.label} files.`
        );
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [
      debouncedSearch,
      source.browsePath,
      source.filterMime,
      source.label,
      source.pageTokenParam,
      source.provider,
    ]
  );

  useEffect(
    () => () => {
      activeAbortControllerRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    loadFiles().catch(() => null);
  }, [loadFiles]);

  async function onSelectFile(file: DriveFileRow) {
    if (importingFileId) {
      return;
    }
    setImportingFileId(file.fileId);
    setError(null);
    try {
      const response = await fetch(source.attachPath, {
        body: JSON.stringify({ fileId: file.fileId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const payload = (await response.json()) as Attachment;
      onAttached(payload);
      toast.success(`Attached “${payload.name}” from ${source.label}`);
      onDone();
    } catch (selectError) {
      const message =
        selectError instanceof Error
          ? selectError.message
          : "Failed to attach file.";
      setError(message);
      toast.error(message);
    } finally {
      setImportingFileId(null);
    }
  }

  return (
    <div className="flex w-[320px] flex-col gap-2 p-1.5">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 border-border/60 bg-background pl-8 shadow-none"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder={source.searchPlaceholder}
          value={search}
        />
      </div>

      {connectorGate ? (
        <div className="flex flex-col items-start gap-3 px-1 py-4">
          <p className="text-sm text-muted-foreground">
            {connectorGate === "reconnect"
              ? source.provider === "google-drive"
                ? "Refreshing Google Drive access…"
                : source.reconnectCopy
              : source.connectCopy}
          </p>
          {connectorGate === "reconnect" &&
          source.provider === "google-drive" ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              One moment…
            </div>
          ) : (
            <Button asChild size="sm" type="button">
              <a href={source.connectHref}>Connect {source.label}</a>
            </Button>
          )}
        </div>
      ) : null}

      {!connectorGate && error ? (
        <p className="px-1 py-2 text-destructive text-sm">{error}</p>
      ) : null}

      {!connectorGate && !error ? (
        <div className="flex max-h-64 flex-col">
          <div className="px-2 py-1 font-medium text-muted-foreground text-xs">
            {debouncedSearch ? "Results" : "Suggested"}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && files.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                Loading…
              </div>
            ) : null}

            {!isLoading && files.length === 0 ? (
              <p className="px-2 py-6 text-center text-muted-foreground text-sm">
                {source.emptyCopy}
              </p>
            ) : null}

            <ul className="flex flex-col">
              {files.map((file) => {
                const isImporting = importingFileId === file.fileId;
                return (
                  <li key={file.fileId}>
                    <button
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                        isImporting && "bg-muted",
                        importingFileId && !isImporting && "opacity-50"
                      )}
                      disabled={Boolean(importingFileId)}
                      onClick={() => onSelectFile(file)}
                      type="button"
                    >
                      <ConnectorProviderIcon
                        className="size-4 shrink-0"
                        provider={source.provider}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {file.title}
                      </span>
                      <span className="shrink-0 font-medium text-[10px] text-muted-foreground">
                        {mimeLabel(file.mimeType)}
                      </span>
                      {isImporting ? (
                        <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {nextPageToken ? (
              <Button
                className="mt-1 w-full"
                disabled={isLoading || Boolean(importingFileId)}
                onClick={() =>
                  loadFiles({ append: true, pageToken: nextPageToken })
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                {isLoading ? "Loading…" : "Load more"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function comingSoonProvider(label: string) {
  toast.message(`${label} attach is coming soon`);
}

function connectorsReturnTo() {
  return encodeURIComponent("/connectors");
}

function attachSourceForProvider(
  tenantSlug: string,
  id: "google-drive" | "confluence" | "sharepoint"
) {
  if (id === "google-drive") {
    return {
      attachPath: `/api/artifacts/${tenantSlug}/attach-from-drive`,
      browsePath: `/api/sources/${tenantSlug}/drive/files`,
      connectCopy: "Connect Google Drive to select files here.",
      connectHref: googleAppOAuthConnectPath(tenantSlug, "google-drive"),
      emptyCopy: "No files found.",
      filterMime: isDriveChatAttachableMime,
      id,
      label: "Google Drive",
      pageTokenParam: "pageToken" as const,
      provider: "google-drive" as const,
      reconnectCopy: "Refreshing Google Drive access…",
      searchPlaceholder: "Search files",
    };
  }
  if (id === "confluence") {
    return {
      attachPath: `/api/artifacts/${tenantSlug}/attach-from-confluence`,
      browsePath: `/api/sources/${tenantSlug}/confluence/attachments`,
      connectCopy: "Connect Confluence to select files here.",
      connectHref: `/api/connectors/oauth/confluence?tenantSlug=${encodeURIComponent(tenantSlug)}&name=${encodeURIComponent("Confluence")}&returnTo=${connectorsReturnTo()}`,
      emptyCopy: "No files found.",
      id,
      label: "Confluence",
      pageTokenParam: "start" as const,
      provider: "confluence" as const,
      reconnectCopy:
        "Confluence is connected, but this action needs updated permissions. Reconnect, then try again.",
      searchPlaceholder: "Search files",
    };
  }
  return {
    attachPath: `/api/artifacts/${tenantSlug}/attach-from-sharepoint`,
    browsePath: `/api/sources/${tenantSlug}/sharepoint/files`,
    connectCopy: "Connect SharePoint to select files here.",
    connectHref: `/api/connectors/oauth/sharepoint?tenantSlug=${encodeURIComponent(tenantSlug)}&name=${encodeURIComponent("SharePoint")}&returnTo=${connectorsReturnTo()}`,
    emptyCopy: "No files found.",
    id,
    label: "SharePoint",
    pageTokenParam: "from" as const,
    provider: "sharepoint" as const,
    reconnectCopy:
      "SharePoint is connected, but this action needs updated permissions. Reconnect, then try again.",
    searchPlaceholder: "Search files",
  };
}

const SELECT_FILE_PROVIDERS: Array<{
  id: string;
  label: string;
  provider?: ConnectorProvider;
  ready: boolean;
  attachId?: "google-drive" | "confluence" | "sharepoint";
}> = [
  {
    attachId: "google-drive",
    id: "google-drive",
    label: "Google Drive",
    provider: "google-drive",
    ready: true,
  },
  {
    attachId: "confluence",
    id: "confluence",
    label: "Confluence",
    provider: "confluence",
    ready: true,
  },
  {
    attachId: "sharepoint",
    id: "sharepoint",
    label: "SharePoint",
    provider: "sharepoint",
    ready: true,
  },
  { id: "onedrive", label: "OneDrive", ready: false },
];

export function ComposerAttachMenu({
  composerBlocked = false,
  fileInputRef,
  status,
  hasVision,
  tenantSlug,
  setAttachments,
}: {
  composerBlocked?: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: string;
  hasVision: boolean;
  tenantSlug: string | null;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOpeningLocal, setIsOpeningLocal] = useState(false);
  const editorFileInputRef = useRef<HTMLInputElement>(null);
  const { setArtifact } = useArtifact();
  const { mutate } = useSWRConfig();
  const ready = status === "ready";
  const disabled = composerBlocked || !ready || isOpeningLocal;

  const openLocalFileInEditor = useCallback(
    async (file: File) => {
      if (!tenantSlug) {
        return;
      }
      setIsOpeningLocal(true);
      setMenuOpen(false);
      const loadingToastId = toast.loading(`Opening “${file.name}”…`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(
          `/api/artifacts/${tenantSlug}/import-from-upload`,
          { body: formData, method: "POST" }
        );
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        const payload = (await response.json()) as ImportedArtifactPayload;
        await openImportedArtifact({ mutate, payload, setArtifact });
        toast.success(`Opened “${payload.title}” in the editor`, {
          id: loadingToastId,
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to open file in the editor.",
          { id: loadingToastId }
        );
      } finally {
        setIsOpeningLocal(false);
        if (editorFileInputRef.current) {
          editorFileInputRef.current.value = "";
        }
      }
    },
    [mutate, setArtifact, tenantSlug]
  );

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Attach, select, or open in editor"
          className={cn(
            "h-8 w-8 rounded-lg p-0 font-medium transition-colors",
            disabled
              ? "cursor-not-allowed text-muted-foreground/40"
              : "cursor-pointer text-muted-foreground/70 hover:text-muted-foreground"
          )}
          data-testid="attachments-button"
          disabled={disabled}
          type="button"
          variant="ghost"
        >
          {isOpeningLocal ? (
            <Loader2Icon className="size-5 animate-spin" />
          ) : (
            <PlusIcon className="size-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <input
        accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            openLocalFileInEditor(file).catch(() => null);
          }
        }}
        ref={editorFileInputRef}
        tabIndex={-1}
        type="file"
      />
      <DropdownMenuContent
        align="start"
        className="z-100 min-w-48 rounded-xl border border-border/60 bg-card/95 p-1 shadow-(--shadow-float) backdrop-blur-xl"
        side="top"
        sideOffset={8}
      >
        <DropdownMenuItem
          className="gap-2 rounded-lg px-2.5 py-2"
          disabled={!hasVision}
          onSelect={() => {
            if (!hasVision) {
              toast.error("This model does not support file attachments.");
              return;
            }
            fileInputRef.current?.click();
          }}
        >
          <PaperclipIcon className="size-3.5 text-muted-foreground" />
          Attach files
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className="gap-2 rounded-lg px-2.5 py-2"
            disabled={!tenantSlug || !hasVision}
          >
            <FileIcon className="size-3.5 text-muted-foreground" />
            Select file
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            className="z-100 min-w-48 rounded-xl border border-border/60 bg-card/95 p-1 shadow-(--shadow-float) backdrop-blur-xl"
            sideOffset={8}
          >
            {SELECT_FILE_PROVIDERS.map((item) => {
              if (item.ready && item.attachId && tenantSlug) {
                const source = attachSourceForProvider(
                  tenantSlug,
                  item.attachId
                );
                return (
                  <DropdownMenuSub key={item.id}>
                    <DropdownMenuSubTrigger className="gap-2 rounded-lg px-2.5 py-2">
                      {item.provider ? (
                        <ConnectorProviderIcon
                          className="size-4 shrink-0"
                          provider={item.provider}
                        />
                      ) : null}
                      {item.label}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      className="z-100 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-(--shadow-float) backdrop-blur-xl"
                      sideOffset={8}
                    >
                      <CloudAttachBrowsePanel
                        onAttached={(attachment) => {
                          setAttachments((current) => [...current, attachment]);
                        }}
                        onDone={() => setMenuOpen(false)}
                        source={source}
                      />
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              }

              return (
                <DropdownMenuItem
                  className="gap-2 rounded-lg px-2.5 py-2"
                  key={item.id}
                  onSelect={() => comingSoonProvider(item.label)}
                >
                  {item.provider ? (
                    <ConnectorProviderIcon
                      className="size-4 shrink-0"
                      provider={item.provider}
                    />
                  ) : (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-[#094AB2] font-bold text-[8px] text-white">
                      Od
                    </span>
                  )}
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          className="gap-2 rounded-lg px-2.5 py-2"
          disabled={!tenantSlug || isOpeningLocal}
          onSelect={(event) => {
            event.preventDefault();
            editorFileInputRef.current?.click();
          }}
        >
          <PencilIcon className="size-3.5 text-muted-foreground" />
          Edit doc or sheet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
