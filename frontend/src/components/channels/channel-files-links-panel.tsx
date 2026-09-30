"use client";

import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { KnowledgeBaseAddFilesMenu } from "@/components/knowledge-bases/knowledge-base-add-files-menu";
import { KnowledgeBaseDrivePickerDialog } from "@/components/knowledge-bases/knowledge-base-drive-picker-dialog";
import { KbCatalogTable } from "@/components/sources/source-catalog-table";
import { workspaceContentWidthClassName } from "@/components/workspace/workspace-page-layout";
import type { KnowledgeBaseDetailResponse } from "@/contracts/knowledge-bases";
import {
  knowledgeBasesApiBase,
  readKnowledgeBasesApiError,
} from "@/lib/knowledge-bases/knowledge-base-api-client";
import { cn } from "@/shared/utils";

export function ChannelFilesLinksPanel({
  tenantSlug,
  knowledgeBaseId,
  viewerUserId,
  viewerEmail,
}: {
  tenantSlug: string;
  knowledgeBaseId: string;
  viewerUserId: string;
  viewerEmail: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isAddDriveOpen, setIsAddDriveOpen] = useState(false);
  const [catalogRefreshToken, setCatalogRefreshToken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const knowledgeBaseApiUrl = `${knowledgeBasesApiBase(tenantSlug)}/${knowledgeBaseId}`;

  const loadAccess = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(knowledgeBaseApiUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load channel knowledge base");
      }
      const payload = (await response.json()) as KnowledgeBaseDetailResponse;
      setCanEdit(payload.canEdit);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load channel knowledge base"
      );
    } finally {
      setIsLoading(false);
    }
  }, [knowledgeBaseApiUrl]);

  useEffect(() => {
    loadAccess().catch(() => undefined);
  }, [loadAccess]);

  async function handleUpload(file: File) {
    if (isUploading || !canEdit) {
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`${knowledgeBaseApiUrl}/upload`, {
        body: formData,
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(response, "Upload failed")
        );
      }
      setCatalogRefreshToken((current) => current + 1);
      toast.success(`Added "${file.name}"`);
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error ? uploadError.message : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div
          className={cn(
            workspaceContentWidthClassName,
            "flex flex-1 items-center justify-center py-12 text-muted-foreground text-sm"
          )}
        >
          <Loader2Icon className="mr-2 size-4 animate-spin" />
          Loading knowledge base…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div
          className={cn(
            workspaceContentWidthClassName,
            "flex flex-1 items-center justify-center py-12 text-center text-destructive text-sm"
          )}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className={cn(
          workspaceContentWidthClassName,
          "flex flex-col gap-5 py-4 pb-8"
        )}
      >
        <p className="text-muted-foreground text-sm">
          Shared with everyone in this conversation. @Kimiro searches it when
          mentioned in chat.
        </p>

        <input
          accept=".pdf,.txt,.md,.docx,.xlsx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleUpload(file).catch(() => undefined);
            }
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />

        <KbCatalogTable
          canPublishToWorkspace={false}
          canWrite={canEdit}
          knowledgeBaseId={knowledgeBaseId}
          knowledgeBaseToolbarActions={
            canEdit ? (
              <KnowledgeBaseAddFilesMenu
                isUploading={isUploading}
                onSelectFromDrive={() => setIsAddDriveOpen(true)}
                onUploadClick={() => fileInputRef.current?.click()}
              />
            ) : null
          }
          notionShareMembers={[]}
          onIndexed={() => {
            setCatalogRefreshToken((current) => current + 1);
          }}
          refreshToken={catalogRefreshToken}
          scope="personal"
          tenantSlug={tenantSlug}
          viewerEmail={viewerEmail}
          viewerUserId={viewerUserId}
        />

        <KnowledgeBaseDrivePickerDialog
          knowledgeBaseId={knowledgeBaseId}
          onAdded={() => {
            setCatalogRefreshToken((current) => current + 1);
          }}
          onOpenChange={setIsAddDriveOpen}
          open={isAddDriveOpen}
          tenantSlug={tenantSlug}
        />
      </div>
    </div>
  );
}
