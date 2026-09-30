"use client";

import { Building2, Search, User } from "lucide-react";
import { useMemo, useState } from "react";
import { SettingsCard } from "@/components/admin/settings-card";
import { UserAvatar } from "@/components/chat/user-avatar";
import type { IntegrationMemberOption } from "@/components/integrations/integration-setup-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";

const MAX_VISIBLE_AVATARS = 3;
const MEMBER_SEARCH_RESULT_LIMIT = 25;

function MemberAvatarStack({
  members,
  maxVisible = MAX_VISIBLE_AVATARS,
}: {
  members: IntegrationMemberOption[];
  maxVisible?: number;
}) {
  const visibleMembers = members.slice(0, maxVisible);

  return (
    <div className="flex items-center">
      {visibleMembers.map((member, index) => (
        <span
          className={cn("relative", index > 0 && "-ml-2")}
          key={member.id}
          style={{ zIndex: visibleMembers.length - index }}
        >
          <UserAvatar
            email={member.email}
            image={member.image}
            name={member.displayName}
            size="sm"
            userId={member.authUserId}
          />
        </span>
      ))}
    </div>
  );
}

function ManageMembersDialog({
  open,
  onOpenChange,
  companyName,
  everyone,
  members,
  selectedMemberIds,
  currentUserId,
  onEveryoneChange,
  onAddMember,
  onRemoveMember,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  everyone: boolean;
  members: IntegrationMemberOption[];
  selectedMemberIds: string[];
  currentUserId: string | null;
  onEveryoneChange: (everyone: boolean) => void;
  onAddMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  const [memberQuery, setMemberQuery] = useState("");

  const selected = useMemo(
    () => new Set(selectedMemberIds),
    [selectedMemberIds]
  );

  const { members: visibleMembers, truncatedCount } = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();

    if (query) {
      const matches = members.filter(
        (member) =>
          member.email.toLowerCase().includes(query) ||
          member.displayName.toLowerCase().includes(query)
      );
      return {
        members: matches.slice(0, MEMBER_SEARCH_RESULT_LIMIT),
        truncatedCount: Math.max(
          0,
          matches.length - MEMBER_SEARCH_RESULT_LIMIT
        ),
      };
    }

    if (everyone) {
      return { members: [], truncatedCount: 0 };
    }

    return {
      members: members.filter((member) => selected.has(member.id)),
      truncatedCount: 0,
    };
  }, [everyone, memberQuery, members, selected]);

  const outlineButtonClassName = "bg-transparent hover:bg-muted/50";

  const listHint = (() => {
    const query = memberQuery.trim();
    if (query) {
      if (truncatedCount > 0) {
        return `Showing ${MEMBER_SEARCH_RESULT_LIMIT} of ${MEMBER_SEARCH_RESULT_LIMIT + truncatedCount} matches. Refine your search.`;
      }
      return null;
    }
    if (everyone) {
      return `All ${members.length.toLocaleString()} members have access. Search to find someone to remove.`;
    }
    if (selectedMemberIds.length === 0) {
      return "Search to add members.";
    }
    return "Search to add more members.";
  })();

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
            Manage access
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Control which members can connect and use this integration.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col gap-3 px-6 py-6">
          <div className="flex flex-col gap-1">
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                everyone
                  ? "bg-muted/50 text-foreground"
                  : "text-foreground hover:bg-muted/20"
              )}
            >
              <input
                checked={everyone}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
                name="integration-access-mode"
                onChange={() => onEveryoneChange(true)}
                type="radio"
              />
              <Building2 className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Everyone at {companyName}</p>
                <p className="text-[13px] text-muted-foreground">
                  All workspace members can use this integration.
                </p>
              </div>
            </label>

            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                everyone
                  ? "text-foreground hover:bg-muted/20"
                  : "bg-muted/50 text-foreground"
              )}
            >
              <input
                checked={!everyone}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
                name="integration-access-mode"
                onChange={() => onEveryoneChange(false)}
                type="radio"
              />
              <User className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">Selected members</p>
                <p className="text-[13px] text-muted-foreground">
                  Only chosen members can use this integration.
                </p>
              </div>
            </label>
          </div>

          {members.length === 0 ? null : (
            <>
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
                    const hasAccess = everyone || selected.has(member.id);
                    const isCurrentUser = member.authUserId === currentUserId;

                    return (
                      <li
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                        key={member.id}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar
                            email={member.email}
                            image={member.image}
                            name={member.displayName}
                            size="sm"
                            userId={member.authUserId}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-sm">
                              {member.displayName}
                              {isCurrentUser ? " (You)" : null}
                            </p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        {everyone || hasAccess ? (
                          <Button
                            className={outlineButtonClassName}
                            onClick={() => onRemoveMember(member.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Remove
                          </Button>
                        ) : (
                          <Button
                            onClick={() => onAddMember(member.id)}
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationAccessSection({
  members,
  everyone,
  selectedMemberIds,
  currentUserId,
  companyName,
  onEveryoneChange,
  onAddMember,
  onRemoveMember,
  accessError,
}: {
  members: IntegrationMemberOption[];
  everyone: boolean;
  selectedMemberIds: string[];
  currentUserId: string | null;
  companyName: string;
  onEveryoneChange: (everyone: boolean) => void;
  onAddMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
  accessError?: string;
}) {
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  const accessMembers = useMemo(() => {
    if (everyone) {
      return members;
    }
    const selected = new Set(selectedMemberIds);
    return members.filter((member) => selected.has(member.id));
  }, [everyone, members, selectedMemberIds]);

  const manageAccessButtonClassName = "bg-transparent hover:bg-muted/50";

  return (
    <>
      <SettingsCard
        action={
          accessMembers.length === 0 ? (
            <Button
              className={manageAccessButtonClassName}
              onClick={() => setMembersDialogOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Add members
            </Button>
          ) : (
            <Button
              aria-label={`Manage access for ${accessMembers.length.toLocaleString()} members`}
              className={cn(manageAccessButtonClassName, "gap-2 pl-1.5")}
              onClick={() => setMembersDialogOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <MemberAvatarStack members={accessMembers} />
              <span className="font-medium text-[13px] tabular-nums">
                {accessMembers.length.toLocaleString()}
              </span>
            </Button>
          )
        }
        banner={
          accessError ? (
            <p className="mb-3 text-destructive text-sm">{accessError}</p>
          ) : null
        }
        description="Control which members can connect and use this integration."
        title="Manage access"
      />

      <ManageMembersDialog
        companyName={companyName}
        currentUserId={currentUserId}
        everyone={everyone}
        members={members}
        onAddMember={onAddMember}
        onEveryoneChange={onEveryoneChange}
        onOpenChange={setMembersDialogOpen}
        onRemoveMember={onRemoveMember}
        open={membersDialogOpen}
        selectedMemberIds={selectedMemberIds}
      />
    </>
  );
}
