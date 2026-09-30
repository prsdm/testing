"use client";

import {
  DownloadIcon,
  FolderOpenIcon,
  Loader2Icon,
  TrashIcon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatLibraryFileDate,
  formatLibraryFileSize,
  type LibraryFileResponse,
} from "@/shared/library/format-library-file";

function libraryApiBase(tenantSlug: string) {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/library/${tenantSlug}`;
}

function libraryListUrl(tenantSlug: string, chatId?: string) {
  const base = libraryApiBase(tenantSlug);
  if (!chatId) {
    return base;
  }
  return `${base}?chatId=${encodeURIComponent(chatId)}`;
}

async function readLibraryApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function LibraryPanel({
  chatId,
  scope = "personal",
  tenantSlug,
}: {
  tenantSlug: string;
  /** When set, only files saved in this chat (e.g. channel room). */
  chatId?: string;
  scope?: "personal" | "room";
}) {
  const [files, setFiles] = useState<LibraryFileResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(libraryListUrl(tenantSlug, chatId));
      if (!response.ok) {
        throw new Error(
          await readLibraryApiError(response, "Failed to load library files")
        );
      }
      const payload = (await response.json()) as {
        files: LibraryFileResponse[];
      };
      setFiles(payload.files);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load library files"
      );
    } finally {
      setIsLoading(false);
    }
  }, [chatId, tenantSlug]);

  useEffect(() => {
    loadFiles().catch(() => undefined);
  }, [loadFiles]);

  async function handleUpload(selected: FileList | null) {
    if (!selected?.length || isUploading) {
      return;
    }
    const file = selected[0];
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (chatId) {
        formData.append("chatId", chatId);
      }
      const response = await fetch(libraryApiBase(tenantSlug), {
        body: formData,
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await readLibraryApiError(response, "Failed to upload file")
        );
      }
      const saved = (await response.json()) as LibraryFileResponse;
      setFiles((current) => [saved, ...current]);
      toast.success(`Uploaded "${saved.name}"`);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload file";
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(file: LibraryFileResponse) {
    if (deletingId) {
      return;
    }
    setDeletingId(file.id);
    try {
      const response = await fetch(`${libraryApiBase(tenantSlug)}/${file.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          await readLibraryApiError(response, "Failed to delete file")
        );
      }
      setFiles((current) => current.filter((entry) => entry.id !== file.id));
      toast.success(`Deleted "${file.name}"`);
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete file"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const introCopy =
    scope === "room"
      ? "Shared deliverables for this conversation — anything @Kimiro saves here or someone uploads. Channels also keep reference files in Knowledge base."
      : "Your personal files — uploads and agent exports. Only you can access them.";

  const emptyCopy =
    scope === "room"
      ? "Ask @Kimiro to create or export something here — saved files show up for everyone in this chat and in the message thread."
      : "Upload a file or ask the agent to save an export to your library.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">{introCopy}</p>
        <div className="flex items-center gap-2">
          <input
            accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(event) => {
              handleUpload(event.target.files).catch(() => undefined);
            }}
            ref={fileInputRef}
            type="file"
          />
          <Button
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            Upload file
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Loading library…
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
          <FolderOpenIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">No files yet</p>
            <p className="text-muted-foreground text-sm">{emptyCopy}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="max-w-[220px] truncate font-medium">
                    {file.name}
                  </TableCell>
                  <TableCell>{formatLibraryFileSize(file.sizeBytes)}</TableCell>
                  <TableCell>{formatLibraryFileDate(file.createdAt)}</TableCell>
                  <TableCell className="capitalize">{file.source}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="icon" variant="ghost">
                        <a
                          download={file.name}
                          href={file.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <DownloadIcon className="size-4" />
                          <span className="sr-only">Download {file.name}</span>
                        </a>
                      </Button>
                      <Button
                        disabled={deletingId === file.id}
                        onClick={() => {
                          handleDelete(file).catch(() => undefined);
                        }}
                        size="icon"
                        variant="ghost"
                      >
                        {deletingId === file.id ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <TrashIcon className="size-4" />
                        )}
                        <span className="sr-only">Delete {file.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
