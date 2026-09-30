"use client";

import { useEffect, useState } from "react";
import {
  NotionShareControls,
  type NotionShareMemberOption,
} from "@/components/sources/notion-share-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NotionShareMode } from "@/shared/sources/notion-share-mode";

export type NotionIndexShareSettings = {
  shareMode: NotionShareMode;
  shareWithEmails?: string[];
};

type NotionIndexShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notionCount: number;
  otherCount: number;
  members: NotionShareMemberOption[];
  viewerEmail: string;
  canPublishToWorkspace: boolean;
  isIndexing: boolean;
  onConfirm: (settings: NotionIndexShareSettings) => void;
};

export function NotionIndexShareDialog({
  open,
  onOpenChange,
  notionCount,
  otherCount,
  members,
  viewerEmail,
  canPublishToWorkspace,
  isIndexing,
  onConfirm,
}: NotionIndexShareDialogProps) {
  const [selectedShareEmails, setSelectedShareEmails] = useState<string[]>([]);
  const [publishToWorkspace, setPublishToWorkspace] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedShareEmails([]);
      setPublishToWorkspace(false);
    }
  }, [open]);

  function handleConfirm() {
    const shareMode = publishToWorkspace
      ? "workspace"
      : selectedShareEmails.length > 0
        ? "selected"
        : "indexers";
    onConfirm({
      shareMode,
      shareWithEmails:
        shareMode === "selected" ? selectedShareEmails : undefined,
    });
  }

  const notionLabel =
    notionCount === 1 ? "1 Notion item" : `${notionCount} Notion items`;
  const otherLabel =
    otherCount === 1 ? "1 other item" : `${otherCount} other items`;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who can see this in Kimi?</DialogTitle>
          <DialogDescription>
            {notionLabel} will use these sharing settings.
            {otherCount > 0
              ? ` ${otherLabel} will index without an extra step.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <NotionShareControls
          canPublishToWorkspace={canPublishToWorkspace}
          members={members}
          onPublishToWorkspaceChange={setPublishToWorkspace}
          onSelectedEmailsChange={setSelectedShareEmails}
          publishToWorkspace={publishToWorkspace}
          selectedEmails={selectedShareEmails}
          viewerEmail={viewerEmail}
        />
        <DialogFooter>
          <Button
            disabled={isIndexing}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isIndexing} onClick={handleConfirm} type="button">
            {isIndexing ? "Indexing…" : "Index"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
