"use client";

import { Loader2Icon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { KnowledgeBaseAddFilesMenu } from "@/components/knowledge-bases/knowledge-base-add-files-menu";
import { KnowledgeBaseDrivePickerDialog } from "@/components/knowledge-bases/knowledge-base-drive-picker-dialog";
import { KnowledgeBaseMembersSection } from "@/components/knowledge-bases/knowledge-base-members-section";
import { KbCatalogTable } from "@/components/sources/source-catalog-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  KnowledgeBaseSummary as KnowledgeBase,
  KnowledgeBaseDetailResponse,
} from "@/contracts/knowledge-bases";
import { cn } from "@/lib/cn";
import {
  knowledgeBasesApiBase,
  readKnowledgeBasesApiError,
} from "@/lib/knowledge-bases/knowledge-base-api-client";
import { knowledgeBasesListPath } from "@/lib/knowledge-bases/knowledge-base-paths";

export function KnowledgeBaseDetailPanel({
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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAddDriveOpen, setIsAddDriveOpen] = useState(false);
  const [catalogRefreshToken, setCatalogRefreshToken] = useState(0);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [canDelete, setCanDelete] = useState(true);
  const [canManageMembers, setCanManageMembers] = useState(false);

  const knowledgeBaseApiUrl = `${knowledgeBasesApiBase(tenantSlug)}/${knowledgeBaseId}`;

  const loadKnowledgeBase = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(knowledgeBaseApiUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load knowledge base");
      }
      const payload = (await response.json()) as KnowledgeBaseDetailResponse;
      setKnowledgeBase({
        ...payload.knowledgeBase,
        viewerRole: payload.viewerRole,
      });
      setCanEdit(payload.canEdit);
      setCanDelete(payload.canDelete);
      setCanManageMembers(payload.canManageMembers);
      setDescriptionDraft(payload.knowledgeBase.description?.trim() ?? "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load knowledge base"
      );
    } finally {
      setIsLoading(false);
    }
  }, [knowledgeBaseApiUrl]);

  useEffect(() => {
    loadKnowledgeBase().catch(() => undefined);
  }, [loadKnowledgeBase]);

  async function handleUpload(file: File) {
    if (isUploading) {
      return;
    }
    setIsUploading(true);
    setError(null);
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
      await loadKnowledgeBase();
      setCatalogRefreshToken((current) => current + 1);
      toast.success(`Added "${file.name}"`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveDescription() {
    if (!knowledgeBase || isSavingDescription) {
      return;
    }

    const nextDescription = descriptionDraft.trim();
    const currentDescription = knowledgeBase.description?.trim() ?? "";
    if (nextDescription === currentDescription) {
      return;
    }

    setIsSavingDescription(true);
    setError(null);
    try {
      const response = await fetch(knowledgeBaseApiUrl, {
        body: JSON.stringify({
          description: nextDescription.length > 0 ? nextDescription : null,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(
            response,
            "Failed to save description"
          )
        );
      }
      const payload = (await response.json()) as {
        knowledgeBase: KnowledgeBase;
      };
      setKnowledgeBase((current) =>
        current
          ? {
              ...payload.knowledgeBase,
              viewerRole: current.viewerRole,
            }
          : {
              ...payload.knowledgeBase,
              viewerRole: "owner",
            }
      );
      setDescriptionDraft(payload.knowledgeBase.description?.trim() ?? "");
      toast.success("Description saved");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save description";
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingDescription(false);
    }
  }

  async function handleDeleteKnowledgeBase() {
    if (!knowledgeBase || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(knowledgeBaseApiUrl, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(
            response,
            "Failed to delete knowledge base"
          )
        );
      }
      toast.success(`Deleted "${knowledgeBase.name}"`);
      setShowDeleteDialog(false);
      router.push(knowledgeBasesListPath());
      router.refresh();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete knowledge base";
      setError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        Loading knowledge base…
      </div>
    );
  }

  if (!knowledgeBase) {
    return (
      <p className="text-destructive text-sm">
        {error ?? "Knowledge base not found"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <KnowledgeBaseMembersSection
          canManageMembers={canManageMembers}
          knowledgeBaseId={knowledgeBaseId}
          tenantSlug={tenantSlug}
        />

        <div className="flex flex-col gap-2">
          <label
            className="font-medium text-sm"
            htmlFor="knowledge-base-description"
          >
            Description
          </label>
          <Textarea
            disabled={!canEdit}
            id="knowledge-base-description"
            onChange={(event) => setDescriptionDraft(event.target.value)}
            placeholder="What is this knowledge base for? Kimiro uses this to choose the right one in chat."
            value={descriptionDraft}
          />
          {canEdit ? (
            <div className="flex justify-end">
              <Button
                disabled={
                  isSavingDescription ||
                  descriptionDraft.trim() ===
                    (knowledgeBase.description?.trim() ?? "")
                }
                onClick={() => {
                  handleSaveDescription().catch(() => undefined);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {isSavingDescription ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                Save description
              </Button>
            </div>
          ) : null}
        </div>

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
            loadKnowledgeBase().catch(() => undefined);
          }}
          onOpenChange={setIsAddDriveOpen}
          open={isAddDriveOpen}
          tenantSlug={tenantSlug}
        />
      </section>

      <div className="flex items-center justify-between gap-3">
        <Button
          asChild
          className="bg-transparent hover:bg-muted/50"
          size="sm"
          variant="outline"
        >
          <Link href={knowledgeBasesListPath()}>Back to knowledge bases</Link>
        </Button>
        {canDelete ? (
          <Button
            disabled={isDeleting}
            onClick={() => setShowDeleteDialog(true)}
            size="sm"
            type="button"
            variant="destructive"
          >
            {isDeleting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
            Delete knowledge base
          </Button>
        ) : null}
      </div>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{knowledgeBase.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All files indexed in this knowledge base
              and their search chunks will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                handleDeleteKnowledgeBase().catch(() => undefined);
              }}
            >
              {isDeleting ? "Deleting…" : "Delete knowledge base"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error ? <p className={cn("text-destructive text-sm")}>{error}</p> : null}
    </div>
  );
}
