"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  KnowledgeBaseMember,
  KnowledgeBaseMemberPickerOption,
} from "@/contracts/knowledge-bases";
import {
  knowledgeBasesApiBase,
  readKnowledgeBasesApiError,
} from "@/lib/knowledge-bases/knowledge-base-api-client";
import type { KnowledgeBaseCollaboratorRole } from "@/shared/knowledge-bases/knowledge-base-access";
import { cn } from "@/shared/utils";

const MAX_VISIBLE_AVATARS = 3;
const MEMBER_SEARCH_RESULT_LIMIT = 25;

function MemberAvatarStack({
  members,
  maxVisible = MAX_VISIBLE_AVATARS,
}: {
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    image: string | null;
  }>;
  maxVisible?: number;
}) {
  const visibleMembers = members.slice(0, maxVisible);

  return (
    <div className="flex items-center">
      {visibleMembers.map((member, index) => (
        <span
          className={cn("relative", index > 0 && "-ml-2")}
          key={member.userId}
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

function ManageKnowledgeBaseMembersDialog({
  open,
  onOpenChange,
  members,
  pickerOptions,
  canManageMembers,
  onAddMember,
  onRemoveMember,
  onUpdateRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: KnowledgeBaseMember[];
  pickerOptions: KnowledgeBaseMemberPickerOption[];
  canManageMembers: boolean;
  onAddMember: (userId: string, role: KnowledgeBaseCollaboratorRole) => void;
  onRemoveMember: (userId: string) => void;
  onUpdateRole: (userId: string, role: KnowledgeBaseCollaboratorRole) => void;
}) {
  const [memberQuery, setMemberQuery] = useState("");
  const [addRole, setAddRole] =
    useState<KnowledgeBaseCollaboratorRole>("viewer");

  useEffect(() => {
    if (!open) {
      setMemberQuery("");
      setAddRole("viewer");
    }
  }, [open]);

  const memberIds = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members]
  );

  const { visiblePickerOptions, truncatedCount } = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) {
      return { truncatedCount: 0, visiblePickerOptions: [] };
    }

    const matches = pickerOptions.filter(
      (option) =>
        !memberIds.has(option.userId) &&
        (option.email.toLowerCase().includes(query) ||
          option.displayName.toLowerCase().includes(query))
    );

    return {
      truncatedCount: Math.max(0, matches.length - MEMBER_SEARCH_RESULT_LIMIT),
      visiblePickerOptions: matches.slice(0, MEMBER_SEARCH_RESULT_LIMIT),
    };
  }, [memberIds, memberQuery, pickerOptions]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share knowledge base</DialogTitle>
          <DialogDescription>
            Only people added here can see and use this knowledge base in chat.
          </DialogDescription>
        </DialogHeader>

        {canManageMembers ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="Search workspace members…"
                value={memberQuery}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Default role
              </span>
              <Select
                onValueChange={(value) =>
                  setAddRole(value as KnowledgeBaseCollaboratorRole)
                }
                value={addRole}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {truncatedCount > 0 ? (
              <p className="text-muted-foreground text-xs">
                Showing {MEMBER_SEARCH_RESULT_LIMIT} matches. Refine your
                search.
              </p>
            ) : null}
            {memberQuery.trim() ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {visiblePickerOptions.length === 0 ? (
                  <li className="text-muted-foreground text-sm">
                    No matching members.
                  </li>
                ) : (
                  visiblePickerOptions.map((option) => (
                    <li key={option.userId}>
                      <button
                        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                        onClick={() => {
                          onAddMember(option.userId, addRole);
                          setMemberQuery("");
                        }}
                        type="button"
                      >
                        <UserAvatar
                          email={option.email}
                          image={option.image}
                          name={option.displayName}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {option.displayName}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">
                Search to add workspace members.
              </p>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm">People with access</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {members.length === 0 ? (
              <li className="text-muted-foreground text-sm">
                Only the owner has access so far.
              </li>
            ) : (
              members.map((member) => (
                <li
                  className="flex items-center gap-2 rounded-md px-1 py-1"
                  key={member.userId}
                >
                  <UserAvatar
                    email={member.email}
                    image={member.image}
                    name={member.displayName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{member.displayName}</p>
                    <p className="truncate text-muted-foreground text-xs">
                      {member.email}
                    </p>
                  </div>
                  {canManageMembers ? (
                    <>
                      <Select
                        onValueChange={(value) =>
                          onUpdateRole(
                            member.userId,
                            value as KnowledgeBaseCollaboratorRole
                          )
                        }
                        value={member.role}
                      >
                        <SelectTrigger className="h-8 w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => onRemoveMember(member.userId)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs capitalize">
                      {member.role}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KnowledgeBaseMembersSection({
  tenantSlug,
  knowledgeBaseId,
  canManageMembers,
}: {
  tenantSlug: string;
  knowledgeBaseId: string;
  canManageMembers: boolean;
}) {
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [members, setMembers] = useState<KnowledgeBaseMember[]>([]);
  const [pickerOptions, setPickerOptions] = useState<
    KnowledgeBaseMemberPickerOption[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const membersApiUrl = `${knowledgeBasesApiBase(tenantSlug)}/${knowledgeBaseId}/members`;

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(membersApiUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(response, "Failed to load members")
        );
      }
      const payload = (await response.json()) as {
        members: KnowledgeBaseMember[];
        pickerOptions: KnowledgeBaseMemberPickerOption[];
      };
      setMembers(payload.members);
      setPickerOptions(payload.pickerOptions);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load members"
      );
    } finally {
      setIsLoading(false);
    }
  }, [membersApiUrl]);

  useEffect(() => {
    loadMembers().catch(() => undefined);
  }, [loadMembers]);

  const overflowCount = Math.max(0, members.length - MAX_VISIBLE_AVATARS);

  async function handleAddMember(
    userId: string,
    role: KnowledgeBaseCollaboratorRole
  ) {
    try {
      const response = await fetch(membersApiUrl, {
        body: JSON.stringify({ role, userId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(response, "Failed to add member")
        );
      }
      await loadMembers();
      toast.success("Member added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add member"
      );
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const response = await fetch(
        `${membersApiUrl}?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(response, "Failed to remove member")
        );
      }
      await loadMembers();
      toast.success("Member removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    }
  }

  async function handleUpdateRole(
    userId: string,
    role: KnowledgeBaseCollaboratorRole
  ) {
    try {
      const response = await fetch(membersApiUrl, {
        body: JSON.stringify({ role, userId }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(response, "Failed to update role")
        );
      }
      await loadMembers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role"
      );
    }
  }

  if (isLoading && members.length === 0) {
    return null;
  }

  return (
    <>
      <SettingsCard
        action={
          canManageMembers ? (
            members.length === 0 ? (
              <button
                className="cursor-pointer text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMembersDialogOpen(true)}
                type="button"
              >
                Share
              </button>
            ) : (
              <button
                className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted/20"
                onClick={() => setMembersDialogOpen(true)}
                type="button"
              >
                <MemberAvatarStack members={members} />
                {overflowCount > 0 ? (
                  <span className="font-medium text-[13px] text-primary">
                    + {overflowCount.toLocaleString()}
                  </span>
                ) : null}
              </button>
            )
          ) : members.length > 0 ? (
            <MemberAvatarStack members={members} />
          ) : null
        }
        description="Workspace members you add can use this knowledge base in chat."
        title="Shared with"
      />

      <ManageKnowledgeBaseMembersDialog
        canManageMembers={canManageMembers}
        members={members}
        onAddMember={(userId, role) => {
          handleAddMember(userId, role).catch(() => undefined);
        }}
        onOpenChange={setMembersDialogOpen}
        onRemoveMember={(userId) => {
          handleRemoveMember(userId).catch(() => undefined);
        }}
        onUpdateRole={(userId, role) => {
          handleUpdateRole(userId, role).catch(() => undefined);
        }}
        open={membersDialogOpen}
        pickerOptions={pickerOptions}
      />
    </>
  );
}
