"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { googleAppOAuthConnectPath } from "@/shared/connectors/providers/google-shared/connect-url";
import { cn } from "@/shared/utils";

type DriveFileRow = {
  fileId: string;
  title: string;
  mimeType: string;
  link: string;
  modifiedTime?: string;
};

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    code?: string;
    error?: string;
  } | null;
  if (payload?.code === "REAUTH_REQUIRED") {
    window.location.assign("/login?reason=reauth");
    return "Re-authentication required.";
  }
  return friendlyDriveError(payload?.error ?? "Request failed.");
}

function friendlyDriveError(raw: string) {
  const trimmed = raw.trim();
  if (
    /fetch failed|failed to fetch|networkerror|load failed|econnrefused/i.test(
      trimmed
    )
  ) {
    return "Couldn’t reach Drive just now. Close this dialog and try again.";
  }
  return trimmed || "Request failed.";
}

function mimeLabel(mimeType: string) {
  if (mimeType.includes("document")) {
    return "Doc";
  }
  if (mimeType.includes("spreadsheet")) {
    return "Sheet";
  }
  if (mimeType.includes("presentation")) {
    return "Slides";
  }
  if (mimeType === "application/pdf") {
    return "PDF";
  }
  return "File";
}

export function KnowledgeBaseDrivePickerDialog({
  open,
  onOpenChange,
  tenantSlug,
  knowledgeBaseId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  knowledgeBaseId: string;
  onAdded: () => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [files, setFiles] = useState<DriveFileRow[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const activeRequestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const browsePath = `${process.env.KIMIRO_BASE_PATH ?? ""}/api/sources/${tenantSlug}/drive/files`;
  const addPath = `${process.env.KIMIRO_BASE_PATH ?? ""}/api/knowledge-bases/${tenantSlug}/${knowledgeBaseId}/drive`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadFiles = useCallback(
    async (args: { append?: boolean; pageToken?: string } = {}) => {
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      if (!args.append) {
        setError(null);
      }
      setNeedsConnect(false);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) {
          params.set("q", debouncedSearch);
        }
        if (args.pageToken) {
          params.set("pageToken", args.pageToken);
        }
        const response = await fetch(`${browsePath}?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        if (!response.ok) {
          const message = await readApiError(response);
          if (activeRequestIdRef.current !== requestId) {
            return;
          }
          if (
            message.toLowerCase().includes("not connected") ||
            message.toLowerCase().includes("connectors")
          ) {
            setNeedsConnect(true);
          }
          setError(message);
          return;
        }
        const payload = (await response.json()) as {
          files: DriveFileRow[];
          nextPageToken?: string;
        };
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        setError(null);
        setFiles((current) =>
          args.append ? [...current, ...payload.files] : payload.files
        );
        setNextPageToken(payload.nextPageToken);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        const raw =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load Drive";
        setError(friendlyDriveError(raw));
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [browsePath, debouncedSearch]
  );

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      return;
    }
    setSelected(new Set());
    setError(null);
    loadFiles().catch(() => undefined);
    return () => {
      abortRef.current?.abort();
    };
  }, [loadFiles, open]);

  function toggleFile(fileId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  function toggleAllFiles(nextValue: boolean) {
    if (!nextValue) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(files.map((file) => file.fileId)));
  }

  const allFilesSelected =
    files.length > 0 && files.every((file) => selected.has(file.fileId));

  async function handleAddSelected() {
    if (selected.size === 0) {
      setError("Select at least one file.");
      return;
    }
    setIsAdding(true);
    setError(null);
    try {
      const response = await fetch(addPath, {
        body: JSON.stringify({ fileIds: [...selected] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        results?: Array<{ fileId: string; ok: boolean; error?: string }>;
      } | null;
      if (!response.ok) {
        setError(friendlyDriveError(payload?.error ?? "Failed to add files."));
        return;
      }
      const failed = payload?.results?.filter((result) => !result.ok) ?? [];
      if (failed.length > 0) {
        setError(
          `Added ${selected.size - failed.length} of ${selected.size}. ${friendlyDriveError(failed.at(0)?.error ?? "")}`
        );
      } else {
        onOpenChange(false);
      }
      setSelected(new Set());
      await onAdded();
    } catch (addError) {
      const raw =
        addError instanceof Error ? addError.message : "Failed to add files.";
      setError(friendlyDriveError(raw));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 py-5">
          <div className="flex flex-col gap-3">
            <ConnectorProviderIcon
              className="size-6 shrink-0"
              provider="google-drive"
            />
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="font-medium text-base leading-normal">
                Google Drive
              </DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                Pick files to index into this knowledge base only — not your
                workspace Sources catalog.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col px-6 py-6">
          {needsConnect ? (
            <p className="mb-4 text-[13px] text-muted-foreground">
              Connect Google Drive on{" "}
              <Link className="underline underline-offset-2" href="/connectors">
                Connectors
              </Link>{" "}
              first, then try again.
            </p>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-medium text-sm">Files</h3>
                {files.length > 0 ? (
                  <Button
                    className="h-auto shrink-0 px-0 text-muted-foreground text-sm hover:bg-transparent hover:text-muted-foreground dark:hover:bg-transparent"
                    disabled={isLoading || isAdding}
                    onClick={() => toggleAllFiles(!allFilesSelected)}
                    type="button"
                    variant="ghost"
                  >
                    {allFilesSelected ? "Deselect all" : "Select all"}
                  </Button>
                ) : null}
              </div>
              <p className="text-[13px] text-muted-foreground">
                Search and select files from your Drive to add to this knowledge
                base.
              </p>
            </div>

            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="rounded-lg pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Drive…"
                value={search}
              />
            </div>

            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {isLoading && files.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground text-sm">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading Drive files…
                </div>
              ) : files.length === 0 ? (
                <p className="px-3 py-6 text-[13px] text-muted-foreground">
                  No Drive files found.
                </p>
              ) : (
                files.map((file) => {
                  const isSelected = selected.has(file.fileId);
                  return (
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                        isSelected
                          ? "bg-muted/50 text-foreground"
                          : "text-foreground hover:bg-background/70"
                      )}
                      key={file.fileId}
                    >
                      <input
                        checked={isSelected}
                        className="size-4 shrink-0 cursor-pointer rounded border-border accent-foreground disabled:cursor-not-allowed"
                        disabled={isAdding}
                        onChange={() => toggleFile(file.fileId)}
                        type="checkbox"
                      />
                      <ConnectorProviderIcon
                        className="size-4 shrink-0"
                        provider="google-drive"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground text-sm">
                          {file.title}
                        </span>
                        <span className="block truncate text-[13px] text-muted-foreground">
                          {mimeLabel(file.mimeType)}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {nextPageToken ? (
              <Button
                className="self-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
                disabled={isLoading}
                onClick={() => {
                  loadFiles({ append: true, pageToken: nextPageToken }).catch(
                    () => undefined
                  );
                }}
                type="button"
                variant="ghost"
              >
                {isLoading ? "Loading…" : "Load more"}
              </Button>
            ) : null}
          </section>

          {error ? (
            <p className="mt-4 text-destructive text-sm">{error}</p>
          ) : null}

          {needsConnect ? (
            <Button
              asChild
              className="mt-4 self-start"
              type="button"
              variant="outline"
            >
              <a href={googleAppOAuthConnectPath(tenantSlug, "google-drive")}>
                Connect Google Drive
              </a>
            </Button>
          ) : null}
        </div>

        <div className="mx-6 h-px bg-border/60" />

        <DialogFooter className="gap-2 px-6 py-4 sm:justify-end">
          <Button
            disabled={isAdding}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isAdding || selected.size === 0 || needsConnect}
            onClick={() => {
              handleAddSelected().catch(() => undefined);
            }}
            type="button"
          >
            {isAdding ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Adding…
              </>
            ) : selected.size > 0 ? (
              `Add ${selected.size} to knowledge base`
            ) : (
              "Add to knowledge base"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
