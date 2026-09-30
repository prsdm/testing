"use client";

import { TagsIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChannelThreadTagCatalogPanel,
  type TagEditDraft,
} from "@/components/channels/thread-tags-header";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChannelThreadTagCatalog } from "@/lib/channels/use-channel-thread-tag-catalog";
import {
  CHANNEL_THREAD_TAG_CATALOG_MAX,
  normalizeThreadTagLabel,
  type ThreadTag,
} from "@/shared/chat/thread-tags";
import { cn } from "@/shared/utils";

export function ChannelThreadTagCatalogControl({
  channelId,
  className,
  isReadonly = false,
}: {
  channelId: string;
  className?: string;
  isReadonly?: boolean;
}) {
  const { catalog, saveCatalog } = useChannelThreadTagCatalog(channelId);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAdd = catalog.length < CHANNEL_THREAD_TAG_CATALOG_MAX;
  const showControl = !isReadonly;

  const persistCatalog = async (nextCatalog: ThreadTag[]) => {
    setSaving(true);
    try {
      await saveCatalog(nextCatalog);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update channel tags"
      );
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const removeTag = async (label: string) => {
    await persistCatalog(
      catalog.filter((tag) => tag.label.toLowerCase() !== label.toLowerCase())
    );
  };

  const saveEditDraft = async (draft: TagEditDraft) => {
    const label = normalizeThreadTagLabel(draft.editLabel);
    if (!label) {
      if (draft.originalLabel === null) {
        toast.error("Enter a tag name to create.");
      }
      return false;
    }

    const currentCatalog = catalogRef.current;

    if (draft.originalLabel === null) {
      if (currentCatalog.length >= CHANNEL_THREAD_TAG_CATALOG_MAX) {
        toast.error("This channel already has the maximum number of tags.");
        return false;
      }
      if (
        currentCatalog.some(
          (tag) => tag.label.toLowerCase() === label.toLowerCase()
        )
      ) {
        toast.error("That tag already exists.");
        return false;
      }
      await persistCatalog([...currentCatalog, { color: draft.color, label }]);
      return true;
    }

    const originalKey = draft.originalLabel.toLowerCase();
    if (
      label.toLowerCase() !== originalKey &&
      currentCatalog.some(
        (tag) => tag.label.toLowerCase() === label.toLowerCase()
      )
    ) {
      toast.error("That tag already exists.");
      return false;
    }

    await persistCatalog(
      currentCatalog.map((tag) =>
        tag.label.toLowerCase() === originalKey
          ? { color: draft.color, label }
          : tag
      )
    );
    return true;
  };

  const tagsAriaLabel =
    catalog.length === 0
      ? "Manage channel tags"
      : `Manage channel tags (${catalog.length})`;

  if (!showControl) {
    return null;
  }

  return (
    <Popover modal={false} onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-label={tagsAriaLabel}
          className={cn(
            "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
            open && "bg-muted/60 text-foreground",
            className
          )}
          disabled={saving}
          type="button"
        >
          <TagsIcon aria-hidden className="size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        avoidCollisions
        className="w-[200px] overflow-visible p-0"
        collisionPadding={16}
        side="bottom"
        sideOffset={8}
      >
        <ChannelThreadTagCatalogPanel
          canAdd={canAdd}
          disabled={saving}
          listOpen={open}
          onDelete={removeTag}
          onSave={saveEditDraft}
          tags={catalog}
        />
      </PopoverContent>
    </Popover>
  );
}
