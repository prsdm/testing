"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SettingsCard } from "@/components/admin/settings-card";
import { UserAvatar } from "@/components/chat/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { GroupMemberPickerOption } from "@/contracts/admin";
import { cn } from "@/shared/utils";

export type GroupDetailMember = {
  personId: string;
  email: string;
  displayName: string;
  image: string | null;
};

const MAX_VISIBLE_AVATARS = 3;
const MEMBER_SEARCH_RESULT_LIMIT = 25;

function MemberAvatarStack({
  members,
  maxVisible = MAX_VISIBLE_AVATARS,
}: {
  members: GroupMemberPickerOption[];
  maxVisible?: number;
}) {
  const visibleMembers = members.slice(0, maxVisible);

  return (
    <div className="flex items-center">
      {visibleMembers.map((member, index) => (
        <span
          className={cn("relative", index > 0 && "-ml-2")}
          key={member.memberId}
          style={{ zIndex: visibleMembers.length - index }}
        >
          <UserAvatar
            className="ring-2 ring-background"
            email={member.email}
            image={member.image}
            name={member.displayName}
            size="sm"
          />
        </span>
      ))}
    </div>
  );
}

function ManageGroupMembersDialog({
  open,
  onOpenChange,
  selectedMembers,
  pickerOptions,
  onAddMember,
  onRemoveMember,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMembers: GroupMemberPickerOption[];
  pickerOptions: GroupMemberPickerOption[];
  onAddMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  const [memberQuery, setMemberQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setMemberQuery("");
    }
  }, [open]);

  const selectedMemberIds = useMemo(
    () => new Set(selectedMembers.map((member) => member.memberId)),
    [selectedMembers]
  );

  const { visibleMembers, truncatedCount } = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();

    if (query) {
      const matches = pickerOptions.filter(
        (member) =>
          member.email.toLowerCase().includes(query) ||
          member.displayName.toLowerCase().includes(query)
      );
      return {
        truncatedCount: Math.max(
          0,
          matches.length - MEMBER_SEARCH_RESULT_LIMIT
        ),
        visibleMembers: matches.slice(0, MEMBER_SEARCH_RESULT_LIMIT),
      };
    }

    return {
      truncatedCount: 0,
      visibleMembers: selectedMembers,
    };
  }, [memberQuery, pickerOptions, selectedMembers]);

  const listHint = (() => {
    const query = memberQuery.trim();
    if (query) {
      if (truncatedCount > 0) {
        return `Showing ${MEMBER_SEARCH_RESULT_LIMIT} of ${MEMBER_SEARCH_RESULT_LIMIT + truncatedCount} matches. Refine your search.`;
      }
      return null;
    }
    if (selectedMembers.length === 0) {
      return "Search to add members.";
    }
    return "Search to add more members.";
  })();

  const outlineButtonClassName = "bg-transparent hover:bg-muted/50";

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setMemberQuery("");
        }
      }}
      open={open}
    >
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 py-5">
          <DialogTitle className="font-medium text-base leading-normal">
            Manage members
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Add or remove workspace members in this group.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col gap-3 px-6 py-6">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-lg pl-9"
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Search members"
              value={memberQuery}
            />
          </div>

          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {listHint ? (
              <li className="px-3 py-2 text-[13px] text-muted-foreground">
                {listHint}
              </li>
            ) : null}
            {visibleMembers.length === 0 ? (
              memberQuery.trim() ? (
                <li className="px-3 py-2 text-[13px] text-muted-foreground">
                  No members match your search.
                </li>
              ) : null
            ) : (
              visibleMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.memberId);

                return (
                  <li
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                    key={member.memberId}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        email={member.email}
                        image={member.image}
                        name={member.displayName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">
                          {member.displayName}
                        </p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <Button
                        className={outlineButtonClassName}
                        onClick={() => onRemoveMember(member.memberId)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        onClick={() => onAddMember(member.memberId)}
                        size="sm"
                        type="button"
                      >
                        Add
                      </Button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GroupMembersSection({
  selectedMembers,
  pickerOptions,
  onAddMember,
  onRemoveMember,
}: {
  selectedMembers: GroupMemberPickerOption[];
  pickerOptions: GroupMemberPickerOption[];
  onAddMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const overflowCount = Math.max(
    0,
    selectedMembers.length - MAX_VISIBLE_AVATARS
  );

  return (
    <>
      <SettingsCard
        action={
          selectedMembers.length === 0 ? (
            <button
              className="cursor-pointer text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMembersDialogOpen(true)}
              type="button"
            >
              Add members
            </button>
          ) : (
            <button
              className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted/20"
              onClick={() => setMembersDialogOpen(true)}
              type="button"
            >
              <MemberAvatarStack members={selectedMembers} />
              {overflowCount > 0 ? (
                <span className="font-medium text-[13px] text-primary">
                  + {overflowCount.toLocaleString()}
                </span>
              ) : null}
            </button>
          )
        }
        description="Control which members belong to this group."
        title="Manage members"
      />

      <ManageGroupMembersDialog
        onAddMember={onAddMember}
        onOpenChange={setMembersDialogOpen}
        onRemoveMember={onRemoveMember}
        open={membersDialogOpen}
        pickerOptions={pickerOptions}
        selectedMembers={selectedMembers}
      />
    </>
  );
}
