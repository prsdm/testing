"use client";

import { CopyIcon, HashIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ChannelMembersSection } from "@/components/channels/channel-members-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChannelDetails, ChannelMember } from "@/contracts/channels";
import {
  channelApiUrl,
  channelMembersApiUrl,
} from "@/lib/channels/channel-api";
import { cn, fetcher } from "@/shared/utils";

type ChannelDetailsTab = "about" | "members";

function formatChannelCreatedDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function AboutField({
  label,
  value,
  placeholder,
  onEdit,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  onEdit?: () => void;
}) {
  const display = value?.trim() || placeholder;
  const isPlaceholder = !value?.trim();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p
          className={cn(
            "mt-1 text-[13px] leading-relaxed",
            isPlaceholder ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {display}
        </p>
      </div>
      {onEdit ? (
        <button
          className="shrink-0 cursor-pointer text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={onEdit}
          type="button"
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}

function DialogTab({
  active,
  children,
  count,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "-mb-px flex cursor-pointer items-center border-b-2 px-3 py-2.5 font-medium text-sm outline-hidden transition-colors focus-visible:ring-0",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
      {count === undefined ? null : ` ${count}`}
    </button>
  );
}

export function ChannelDetailsDialog({
  channelId,
  channelTitle,
  initialTab = "about",
  onMembersChanged,
  onOpenChange,
  open,
  tenantSlug,
}: {
  channelId: string;
  channelTitle: string;
  initialTab?: ChannelDetailsTab;
  onMembersChanged?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantSlug: string;
}) {
  const [tab, setTab] = useState<ChannelDetailsTab>(initialTab);
  const [membersPaneReady, setMembersPaneReady] = useState(false);

  const detailsKey = open ? channelApiUrl(tenantSlug, channelId) : null;
  const membersKey = open ? channelMembersApiUrl(tenantSlug, channelId) : null;

  const { data: detailsData } = useSWR<{ channel: ChannelDetails }>(
    detailsKey,
    fetcher
  );
  const { data: membersData, mutate: mutateMembers } = useSWR<{
    members: ChannelMember[];
  }>(membersKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const details = detailsData?.channel;
  const memberCount = membersData?.members.length ?? 0;

  useEffect(() => {
    if (!open) {
      setMembersPaneReady(false);
      return;
    }
    setTab(initialTab);
    if (initialTab === "members") {
      setMembersPaneReady(true);
    }
  }, [initialTab, open]);

  useEffect(() => {
    if (tab === "members") {
      setMembersPaneReady(true);
    }
  }, [tab]);

  async function copyChannelId() {
    const id = details?.id ?? channelId;
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Channel ID copied");
    } catch {
      toast.error("Could not copy channel ID");
    }
  }

  function notifyEditSoon() {
    toast.message("Editing channel topic and description is coming soon.");
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex h-[min(600px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-md [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 gap-0 px-6 pt-5 pb-4">
          <div className="flex flex-col gap-3">
            <HashIcon
              aria-hidden
              className="size-8 shrink-0 stroke-[2.5] text-foreground"
            />
            <div className="flex flex-col gap-0">
              <DialogTitle className="font-medium text-base leading-normal">
                {channelTitle}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground">
                Channel details and members for this workspace.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="shrink-0 px-6">
          <nav aria-label="Channel details" className="flex gap-0.5">
            <DialogTab active={tab === "about"} onClick={() => setTab("about")}>
              About
            </DialogTab>
            <DialogTab
              active={tab === "members"}
              count={memberCount}
              onClick={() => setTab("members")}
            >
              Members
            </DialogTab>
          </nav>
        </div>

        <div className="mx-6 h-px shrink-0 bg-border/60" />

        <div className="relative min-h-0 flex-1">
          <div
            className={cn(
              "absolute inset-0 overflow-y-hidden px-6 py-6",
              tab !== "about" && "hidden"
            )}
          >
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-3">
                <AboutField
                  label="Description"
                  onEdit={notifyEditSoon}
                  placeholder="Add a description"
                />
                <AboutField
                  label="Created by"
                  value={
                    details
                      ? `${details.createdByName} on ${formatChannelCreatedDate(details.createdAt)}`
                      : "…"
                  }
                />
              </section>

              <button
                className="cursor-pointer text-left text-destructive text-[13px] transition-colors hover:underline"
                onClick={() =>
                  toast.message("Leaving channels is coming soon.")
                }
                type="button"
              >
                Leave channel
              </button>

              <button
                className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  copyChannelId().catch(() => undefined);
                }}
                type="button"
              >
                <span className="truncate">
                  Channel ID: {details?.id ?? channelId}
                </span>
                <CopyIcon className="size-3.5 shrink-0" />
              </button>
            </div>
          </div>

          <div
            className={cn(
              "no-scrollbar absolute inset-0 overflow-y-auto px-6 py-6",
              tab !== "members" && "hidden"
            )}
          >
            {membersPaneReady ? (
              <ChannelMembersSection
                channelId={channelId}
                onMembersChanged={() => {
                  mutateMembers().catch(() => undefined);
                  onMembersChanged?.();
                }}
                tenantSlug={tenantSlug}
              />
            ) : null}
          </div>
        </div>

        <div className="mx-6 h-px shrink-0 bg-border/60" />

        <DialogFooter className="shrink-0 gap-2 px-6 py-4 sm:justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
