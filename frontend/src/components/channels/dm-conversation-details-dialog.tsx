"use client";

import { CopyIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { GroupDmAvatarStack } from "@/components/chat/group-dm-avatar-stack";
import { UserAvatar } from "@/components/chat/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DmMemberSummary } from "@/contracts/dms";

export function DmConversationDetailsDialog({
  chatId,
  email,
  image,
  isGroup,
  members,
  name,
  onOpenChange,
  open,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  isGroup: boolean;
  name: string;
  userId?: string | null;
  email?: string | null;
  image?: string | null;
  members: DmMemberSummary[];
}) {
  async function copyConversationId() {
    try {
      await navigator.clipboard.writeText(chatId);
      toast.success("Copied conversation ID");
    } catch {
      toast.error("Could not copy conversation ID");
    }
  }

  const primaryEmail = email?.trim() || null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-md [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 gap-0 px-6 pt-5 pb-4">
          <div className="flex flex-col gap-3">
            {isGroup ? (
              <GroupDmAvatarStack
                className="h-10 w-16 shrink-0"
                members={members}
              />
            ) : (
              <UserAvatar
                className="shrink-0 ring-0"
                email={primaryEmail ?? undefined}
                image={image ?? null}
                name={name}
                size="md"
                userId={userId ?? undefined}
              />
            )}
            <div className="flex flex-col gap-0">
              <DialogTitle className="font-medium text-base leading-normal">
                {name}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground">
                {isGroup
                  ? "Group conversation in this workspace."
                  : "Direct message in this workspace."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mx-6 h-px shrink-0 bg-border/60" />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            {!isGroup && primaryEmail ? (
              <section className="rounded-lg border border-border/60 p-4">
                <p className="font-medium text-sm">Contact</p>
                <a
                  className="mt-2 inline-flex items-center gap-2 text-[13px] text-primary hover:underline"
                  href={`mailto:${primaryEmail}`}
                >
                  <MailIcon aria-hidden className="size-4 shrink-0" />
                  {primaryEmail}
                </a>
              </section>
            ) : null}

            {isGroup && members.length > 0 ? (
              <section className="flex flex-col gap-3">
                <p className="font-medium text-sm">Members</p>
                <ul className="flex flex-col gap-2">
                  {members.map((member) => (
                    <li
                      className="flex min-w-0 items-center gap-2"
                      key={member.userId}
                    >
                      <UserAvatar
                        className="shrink-0 ring-0"
                        email={member.email}
                        image={member.image}
                        name={member.displayName}
                        size="sm"
                        userId={member.userId}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[13px]">
                          {member.displayName}
                        </p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <button
              className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                copyConversationId().catch(() => undefined);
              }}
              type="button"
            >
              <span className="truncate">Conversation ID: {chatId}</span>
              <CopyIcon className="size-3.5 shrink-0" />
            </button>
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
