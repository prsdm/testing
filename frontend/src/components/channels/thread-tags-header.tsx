"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ThreadTagPill,
  ThreadTagPillRow,
} from "@/components/channels/thread-tag-pill";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateThreadRootMetadata } from "@/lib/chat/update-thread-tags-client";
import {
  normalizeThreadTagLabel,
  normalizeThreadTags,
  readMessageThreadTags,
  resolveThreadTagsAgainstCatalog,
  THREAD_TAG_COLOR_OPTIONS,
  THREAD_TAG_COLOR_STYLES,
  THREAD_TAG_MAX_COUNT,
  THREAD_TAG_MAX_LENGTH,
  type ThreadTag,
  type ThreadTagColorId,
} from "@/shared/chat/thread-tags";
import type { ChatMessage } from "@/shared/types";
import { cn } from "@/shared/utils";

const NEW_TAG_EDIT_KEY = "__new__";

function patchMessageTags(
  messages: ChatMessage[],
  messageId: string,
  threadTags: ThreadTag[]
): ChatMessage[] {
  return messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          metadata: {
            ...message.metadata,
            threadTags: threadTags.length > 0 ? threadTags : undefined,
          },
        }
      : message
  );
}

function ThreadTagColorPicker({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (color: ThreadTagColorId) => void;
  value: ThreadTagColorId;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-normal text-[11px] text-muted-foreground">Color</p>
      <div
        aria-label="Tag color"
        className="grid grid-cols-5 gap-1"
        role="listbox"
      >
        {THREAD_TAG_COLOR_OPTIONS.map(({ id, label }) => {
          const selected = id === value;
          return (
            <button
              aria-label={label}
              aria-selected={selected}
              className={cn(
                "relative flex size-7 cursor-pointer items-center justify-center rounded-md border transition-shadow hover:opacity-90 disabled:opacity-50",
                THREAD_TAG_COLOR_STYLES[id].swatchBox,
                selected
                  ? "ring-2 ring-sky-500 ring-offset-1 ring-offset-background"
                  : "border-transparent"
              )}
              disabled={disabled}
              key={id}
              onClick={() => onChange(id)}
              onMouseDown={(event) => event.preventDefault()}
              role="option"
              type="button"
            >
              {selected ? (
                <CheckIcon
                  aria-hidden
                  className="size-3 text-foreground"
                  strokeWidth={2.5}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type TagEditDraft = {
  color: ThreadTagColorId;
  editLabel: string;
  originalLabel: string | null;
};

export function ThreadTagsHeader({
  catalog,
  chatId,
  className,
  isReadonly = false,
  messages,
  rootMessageId,
  setMessages,
}: {
  catalog: ThreadTag[];
  chatId: string;
  className?: string;
  isReadonly?: boolean;
  messages: ChatMessage[];
  rootMessageId: string;
  setMessages: (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])
  ) => void;
}) {
  const rootMessage = useMemo(
    () => messages.find((message) => message.id === rootMessageId),
    [messages, rootMessageId]
  );
  const tags = useMemo(
    () =>
      resolveThreadTagsAgainstCatalog(
        readMessageThreadTags(rootMessage?.metadata),
        catalog
      ),
    [catalog, rootMessage?.metadata]
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAssignMore = tags.length < THREAD_TAG_MAX_COUNT;
  const showAssignPopover =
    !isReadonly && catalog.length > 0 && (canAssignMore || tags.length > 0);

  const persistTags = async (nextTags: ThreadTag[]) => {
    const normalized = resolveThreadTagsAgainstCatalog(
      normalizeThreadTags(nextTags),
      catalog
    );
    const previous = tags;
    setMessages((current) =>
      patchMessageTags(current, rootMessageId, normalized)
    );
    setSaving(true);
    try {
      await updateThreadRootMetadata({
        chatId,
        messageId: rootMessageId,
        threadTags: normalized,
      });
    } catch (error) {
      setMessages((current) =>
        patchMessageTags(current, rootMessageId, previous)
      );
      toast.error(
        error instanceof Error ? error.message : "Could not update tags"
      );
    } finally {
      setSaving(false);
    }
  };

  const removeTag = async (label: string) => {
    await persistTags(
      tags.filter((tag) => tag.label.toLowerCase() !== label.toLowerCase())
    );
  };

  const toggleCatalogTag = async (tag: ThreadTag) => {
    const key = tag.label.toLowerCase();
    const assigned = tags.some((item) => item.label.toLowerCase() === key);
    if (assigned) {
      await removeTag(tag.label);
      return;
    }
    if (tags.length >= THREAD_TAG_MAX_COUNT) {
      toast.error(`Threads can have at most ${THREAD_TAG_MAX_COUNT} tags.`);
      return;
    }
    await persistTags([...tags, tag]);
  };

  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
    >
      <ThreadTagPillRow
        onRemoveTag={isReadonly ? undefined : removeTag}
        tags={tags}
      />
      {showAssignPopover ? (
        <Popover modal={false} onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <button
              aria-label="Tag thread"
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
              disabled={saving}
              type="button"
            >
              <PlusIcon aria-hidden className="size-3.5" strokeWidth={2} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[264px] overflow-visible p-0"
            sideOffset={6}
          >
            <ThreadTagAssignPanel
              assigned={tags}
              catalog={catalog}
              disabled={saving}
              onToggle={toggleCatalogTag}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function ThreadTagAssignPanel({
  assigned,
  catalog,
  disabled,
  onToggle,
}: {
  assigned: ThreadTag[];
  catalog: ThreadTag[];
  disabled?: boolean;
  onToggle: (topic: ThreadTag) => void | Promise<void>;
}) {
  const assignedKeys = useMemo(
    () => new Set(assigned.map((topic) => topic.label.toLowerCase())),
    [assigned]
  );

  return (
    <div className="flex flex-col py-1.5">
      <p className="px-3 pb-1 font-medium text-[13px] text-muted-foreground">
        Tag thread
      </p>
      <ul className="flex list-none flex-col px-1">
        {catalog.map((tag) => {
          const selected = assignedKeys.has(tag.label.toLowerCase());
          return (
            <li key={tag.label}>
              <button
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
                disabled={disabled}
                onClick={() => void onToggle(tag)}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/40"
                  )}
                >
                  {selected ? (
                    <CheckIcon aria-hidden className="size-3" strokeWidth={3} />
                  ) : null}
                </span>
                <ThreadTagPill className="min-w-0" tag={tag} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChannelThreadTagCatalogPanel({
  canAdd,
  disabled,
  listOpen,
  onDelete,
  onSave,
  tags,
}: {
  canAdd: boolean;
  disabled?: boolean;
  listOpen: boolean;
  onDelete: (label: string) => Promise<void>;
  onSave: (draft: TagEditDraft) => Promise<boolean>;
  tags: ThreadTag[];
}) {
  const [expandedEditKey, setExpandedEditKey] = useState<string | null>(null);

  useEffect(() => {
    if (!listOpen) {
      setExpandedEditKey(null);
    }
  }, [listOpen]);

  const toggleEdit = (key: string) => {
    setExpandedEditKey((current) => (current === key ? null : key));
  };

  const saveDraft = async (draft: TagEditDraft) => {
    const saved = await onSave(draft);
    if (saved) {
      setExpandedEditKey(null);
    }
    return saved;
  };

  const createOpen = expandedEditKey === NEW_TAG_EDIT_KEY;

  return (
    <div className="flex flex-col px-2 py-2">
      <div className="flex items-center justify-between gap-2 pb-1">
        <p className="font-normal text-[11px] text-muted-foreground">
          Channel tags
        </p>
        {canAdd ? (
          <TagEditAnchorPopover
            disabled={disabled}
            draft={{
              color: "default",
              editLabel: "",
              originalLabel: null,
            }}
            editOpen={createOpen}
            onClose={() => setExpandedEditKey(null)}
            onSave={saveDraft}
            trigger={
              <button
                aria-expanded={createOpen}
                aria-label="Create tag"
                className={cn(
                  "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted/60 disabled:opacity-50",
                  createOpen && "bg-muted/60 text-foreground"
                )}
                disabled={disabled}
                onClick={() => toggleEdit(NEW_TAG_EDIT_KEY)}
                type="button"
              >
                <PlusIcon aria-hidden className="size-3.5" strokeWidth={2} />
              </button>
            }
          />
        ) : null}
      </div>
      {tags.length > 0 ? (
        <ul className="flex list-none flex-col">
          {tags.map((tag) => {
            const editOpen = expandedEditKey === tag.label;
            return (
              <li key={tag.label}>
                <TagEditChevronPopover
                  disabled={disabled}
                  draft={{
                    color: tag.color,
                    editLabel: tag.label,
                    originalLabel: tag.label,
                  }}
                  editOpen={editOpen}
                  onClose={() => setExpandedEditKey(null)}
                  onDelete={async () => {
                    await onDelete(tag.label);
                    setExpandedEditKey(null);
                  }}
                  onSave={saveDraft}
                  trigger={
                    <button
                      aria-expanded={editOpen}
                      aria-label={
                        editOpen
                          ? `Close ${tag.label} tag options`
                          : `Edit ${tag.label} tag`
                      }
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted/45 disabled:opacity-50",
                        editOpen && "bg-muted/45"
                      )}
                      disabled={disabled}
                      onClick={() => toggleEdit(tag.label)}
                      type="button"
                    >
                      <ThreadTagPill
                        className="max-w-[6rem] shrink-0"
                        tag={tag}
                        variant="card"
                      />
                      <span aria-hidden className="min-w-0 flex-1" />
                      {editOpen ? (
                        <ChevronDownIcon
                          aria-hidden
                          className="size-3.5 shrink-0 text-muted-foreground/70"
                          strokeWidth={2}
                        />
                      ) : (
                        <ChevronRightIcon
                          aria-hidden
                          className="size-3.5 shrink-0 text-muted-foreground/70"
                          strokeWidth={2}
                        />
                      )}
                    </button>
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function TagEditPopoverContent({
  disabled,
  draft,
  onCommitSuccess,
  onDelete,
  onPendingChange,
  onSave,
}: {
  disabled?: boolean;
  draft: TagEditDraft;
  onCommitSuccess?: () => void;
  onDelete?: () => void | Promise<void>;
  onPendingChange?: (draft: TagEditDraft) => void;
  onSave: (draft: TagEditDraft) => Promise<boolean>;
}) {
  return (
    <PopoverContent
      align="start"
      avoidCollisions
      className="w-[200px] overflow-hidden p-0"
      collisionPadding={16}
      onOpenAutoFocus={(event) => event.preventDefault()}
      side="right"
      sideOffset={8}
    >
      <TagEditPopoverPanel
        disabled={disabled}
        draft={draft}
        onCommitSuccess={onCommitSuccess}
        onDelete={onDelete}
        onPendingChange={onPendingChange}
        onSave={onSave}
      />
    </PopoverContent>
  );
}

function TagEditChevronPopover({
  disabled,
  draft,
  editOpen,
  onClose,
  onDelete,
  onSave,
  trigger,
}: {
  disabled?: boolean;
  draft: TagEditDraft;
  editOpen: boolean;
  onClose: () => void;
  onDelete?: () => void | Promise<void>;
  onSave: (draft: TagEditDraft) => Promise<boolean>;
  trigger: ReactNode;
}) {
  return (
    <Popover
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={editOpen}
    >
      <PopoverAnchor asChild>{trigger}</PopoverAnchor>
      {editOpen ? (
        <TagEditPopoverContent
          disabled={disabled}
          draft={draft}
          onCommitSuccess={onClose}
          onDelete={onDelete}
          onSave={onSave}
        />
      ) : null}
    </Popover>
  );
}

function TagEditAnchorPopover({
  disabled,
  draft,
  editOpen,
  onClose,
  onSave,
  trigger,
}: {
  disabled?: boolean;
  draft: TagEditDraft;
  editOpen: boolean;
  onClose: () => void;
  onSave: (draft: TagEditDraft) => Promise<boolean>;
  trigger: ReactNode;
}) {
  const pendingDraftRef = useRef(draft);
  const savedOnCommitRef = useRef(false);

  useEffect(() => {
    pendingDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (editOpen) {
      savedOnCommitRef.current = false;
    }
  }, [editOpen]);

  return (
    <Popover
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          if (savedOnCommitRef.current) {
            savedOnCommitRef.current = false;
            onClose();
            return;
          }
          void onSave(pendingDraftRef.current).then((saved) => {
            if (saved) {
              onClose();
            }
          });
        }
      }}
      open={editOpen}
    >
      <PopoverAnchor asChild>{trigger}</PopoverAnchor>
      {editOpen ? (
        <TagEditPopoverContent
          disabled={disabled}
          draft={draft}
          onCommitSuccess={() => {
            savedOnCommitRef.current = true;
            onClose();
          }}
          onPendingChange={(next) => {
            pendingDraftRef.current = next;
          }}
          onSave={onSave}
        />
      ) : null}
    </Popover>
  );
}

function TagEditPopoverPanel({
  disabled,
  draft,
  onCommitSuccess,
  onDelete,
  onPendingChange,
  onSave,
}: {
  disabled?: boolean;
  draft: TagEditDraft;
  onCommitSuccess?: () => void;
  onDelete?: () => void | Promise<void>;
  onPendingChange?: (draft: TagEditDraft) => void;
  onSave: (draft: TagEditDraft) => Promise<boolean>;
}) {
  const [editLabel, setEditLabel] = useState(draft.editLabel);
  const [color, setColor] = useState(draft.color);
  const isCreate = draft.originalLabel === null;

  useEffect(() => {
    setEditLabel(draft.editLabel);
    setColor(draft.color);
  }, [draft.color, draft.editLabel]);

  const buildDraft = (overrides?: Partial<TagEditDraft>): TagEditDraft => ({
    color,
    editLabel,
    originalLabel: draft.originalLabel,
    ...overrides,
  });

  const syncPending = (overrides?: Partial<TagEditDraft>) => {
    onPendingChange?.(buildDraft(overrides));
  };

  const submitDraft = async (next: TagEditDraft) => {
    try {
      const saved = await onSave(next);
      if (saved) {
        onCommitSuccess?.();
        return true;
      }
      if (isCreate && !normalizeThreadTagLabel(next.editLabel)) {
        toast.error("Enter a tag name to create.");
      }
      return false;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save tag"
      );
      return false;
    }
  };

  const commit = (next: TagEditDraft) => {
    void submitDraft(next);
  };

  const commitFromInput = (rawLabel: string) => {
    void submitDraft(buildDraft({ editLabel: rawLabel }));
  };

  return (
    <form
      autoComplete="off"
      className="flex flex-col gap-2 px-2 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextLabel = new FormData(event.currentTarget).get(
          "channelThreadTagLabel"
        );
        void submitDraft(
          buildDraft({
            editLabel: typeof nextLabel === "string" ? nextLabel : editLabel,
          })
        );
      }}
    >
      <Input
        autoComplete="off"
        autoFocus
        className="h-8 rounded-md px-2 text-sm shadow-none"
        disabled={disabled}
        maxLength={THREAD_TAG_MAX_LENGTH}
        name="channelThreadTagLabel"
        onBlur={() => {
          if (!isCreate) {
            commit(buildDraft());
          }
        }}
        onChange={(event) => {
          const nextLabel = event.target.value;
          setEditLabel(nextLabel);
          syncPending({ editLabel: nextLabel });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          commitFromInput(event.currentTarget.value);
        }}
        placeholder="Tag name"
        spellCheck={false}
        value={editLabel}
      />
      <button className="sr-only" disabled={disabled} type="submit">
        Save tag
      </button>

      <ThreadTagColorPicker
        disabled={disabled}
        onChange={(nextColor) => {
          setColor(nextColor);
          syncPending({ color: nextColor });
          if (!isCreate) {
            commit(buildDraft({ color: nextColor }));
          }
        }}
        value={color}
      />

      {onDelete ? (
        <button
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-destructive/45 bg-background py-1.5 text-destructive text-xs transition-colors hover:bg-destructive/5 disabled:opacity-50"
          disabled={disabled}
          onClick={() => void onDelete()}
          type="button"
        >
          <Trash2Icon
            aria-hidden
            className="size-3.5 shrink-0"
            strokeWidth={2}
          />
          Delete tag
        </button>
      ) : null}
    </form>
  );
}
