"use client";

import { UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/admin/settings-card";
import { GroupMembersSection } from "@/components/groups/group-members-section";
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
import { Input } from "@/components/ui/input";
import {
  WorkspacePageBackButton,
  WorkspacePageHeader,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";
import type { GroupMemberPickerOption } from "@/contracts/admin";

export type { GroupDetailMember } from "@/components/groups/group-members-section";

export type GroupDetailInitial = {
  id: string;
  name: string;
  members: Array<{
    personId: string;
    email: string;
    displayName: string;
    image: string | null;
  }>;
};

function memberIdsFromSavedMembers(
  members: GroupDetailInitial["members"],
  pickerOptions: GroupMemberPickerOption[]
) {
  const ids: string[] = [];

  for (const member of members) {
    const option = pickerOptions.find(
      (entry) =>
        entry.personId === member.personId ||
        entry.email.toLowerCase() === member.email.toLowerCase()
    );
    if (option) {
      ids.push(option.memberId);
    }
  }

  return ids;
}

function memberIdsChanged(saved: string[], draft: string[]) {
  if (saved.length !== draft.length) {
    return true;
  }

  const savedSet = new Set(saved);
  return draft.some((memberId) => !savedSet.has(memberId));
}

const DEFAULT_CREATE_GROUP_NAME = "New group";

export function GroupDetailView({
  tenantSlug,
  pickerOptions,
  mode = "edit",
  initial,
}: {
  tenantSlug: string;
  pickerOptions: GroupMemberPickerOption[];
  mode?: "create" | "edit";
  initial?: GroupDetailInitial;
}) {
  const isCreateMode = mode === "create";
  const router = useRouter();
  const [group, setGroup] = useState<GroupDetailInitial>(
    initial ?? { id: "", members: [], name: "" }
  );
  const [nameDraft, setNameDraft] = useState(
    initial?.name ?? DEFAULT_CREATE_GROUP_NAME
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    initial ? memberIdsFromSavedMembers(initial.members, pickerOptions) : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const savedMemberIds = useMemo(
    () => memberIdsFromSavedMembers(group.members, pickerOptions),
    [group.members, pickerOptions]
  );

  useEffect(() => {
    if (isCreateMode || !initial) {
      return;
    }

    setGroup(initial);
    setNameDraft(initial.name);
    setSelectedMemberIds(
      memberIdsFromSavedMembers(initial.members, pickerOptions)
    );
  }, [initial, isCreateMode, pickerOptions]);

  const selectedMembers = useMemo(
    () =>
      selectedMemberIds
        .map(
          (memberId) =>
            pickerOptions.find((option) => option.memberId === memberId) ?? null
        )
        .filter((member): member is GroupMemberPickerOption => member !== null),
    [pickerOptions, selectedMemberIds]
  );

  const isNameDirty = isCreateMode
    ? nameDraft.trim().length > 0
    : nameDraft.trim() !== group.name;
  const isMembersDirty = isCreateMode
    ? selectedMemberIds.length > 0
    : memberIdsChanged(savedMemberIds, selectedMemberIds);
  const hasPendingChanges = isCreateMode
    ? nameDraft.trim().length > 0
    : isNameDirty || isMembersDirty;

  function addMember(memberId: string) {
    if (selectedMemberIds.includes(memberId)) {
      return;
    }
    setSelectedMemberIds((current) => [...current, memberId]);
  }

  function removeMember(memberId: string) {
    setSelectedMemberIds((current) => current.filter((id) => id !== memberId));
  }

  async function saveChanges() {
    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      toast.error("Group name is required.");
      return;
    }

    if (!hasPendingChanges) {
      return;
    }

    setIsSaving(true);

    if (isCreateMode) {
      const createResponse = await fetch(`/api/admin/${tenantSlug}/groups`, {
        body: JSON.stringify({ name: trimmedName }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!createResponse.ok) {
        const payload = (await createResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        setIsSaving(false);
        toast.error(payload?.error ?? "Failed to create group.");
        return;
      }

      const created = (await createResponse.json()) as GroupDetailInitial & {
        memberCount?: number;
        createdAt?: string;
      };

      if (selectedMemberIds.length > 0) {
        const addResponse = await fetch(
          `/api/admin/${tenantSlug}/groups/${created.id}/members`,
          {
            body: JSON.stringify({ memberIds: selectedMemberIds }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        );

        if (!addResponse.ok) {
          const payload = (await addResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          setIsSaving(false);
          toast.error(payload?.error ?? "Failed to add members.");
          return;
        }
      }

      setIsSaving(false);
      toast.success("Group created.");
      router.replace(`/admin/groups/${created.id}`);
      router.refresh();
      return;
    }

    if (isNameDirty) {
      const response = await fetch(
        `/api/admin/${tenantSlug}/groups/${group.id}`,
        {
          body: JSON.stringify({ name: trimmedName }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setIsSaving(false);
        toast.error(payload?.error ?? "Failed to update group.");
        return;
      }
    }

    if (isMembersDirty) {
      const savedSet = new Set(savedMemberIds);
      const draftSet = new Set(selectedMemberIds);
      const toAdd = selectedMemberIds.filter(
        (memberId) => !savedSet.has(memberId)
      );
      const toRemove = savedMemberIds.filter(
        (memberId) => !draftSet.has(memberId)
      );

      if (toAdd.length > 0) {
        const addResponse = await fetch(
          `/api/admin/${tenantSlug}/groups/${group.id}/members`,
          {
            body: JSON.stringify({ memberIds: toAdd }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        );

        if (!addResponse.ok) {
          const payload = (await addResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          setIsSaving(false);
          toast.error(payload?.error ?? "Failed to add members.");
          return;
        }
      }

      for (const memberId of toRemove) {
        const option = pickerOptions.find(
          (entry) => entry.memberId === memberId
        );
        const personId =
          option?.personId ??
          group.members.find(
            (member) =>
              option &&
              member.email.toLowerCase() === option.email.toLowerCase()
          )?.personId;

        if (!personId) {
          continue;
        }

        const removeResponse = await fetch(
          `/api/admin/${tenantSlug}/groups/${group.id}/members`,
          {
            body: JSON.stringify({ personId }),
            headers: { "content-type": "application/json" },
            method: "DELETE",
          }
        );

        if (!removeResponse.ok) {
          const payload = (await removeResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          setIsSaving(false);
          toast.error(payload?.error ?? "Failed to remove members.");
          return;
        }
      }
    }

    const detailResponse = await fetch(
      `/api/admin/${tenantSlug}/groups/${group.id}`
    );

    setIsSaving(false);

    if (!detailResponse.ok) {
      toast.error("Failed to refresh group.");
      router.refresh();
      return;
    }

    const updated = (await detailResponse.json()) as GroupDetailInitial;
    setGroup(updated);
    setNameDraft(updated.name);
    setSelectedMemberIds(
      memberIdsFromSavedMembers(updated.members, pickerOptions)
    );
    toast.success("Changes saved.");
    router.refresh();
  }

  async function deleteGroup() {
    setIsDeleting(true);
    const response = await fetch(
      `/api/admin/${tenantSlug}/groups/${group.id}`,
      { method: "DELETE" }
    );
    setIsDeleting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to delete group.");
      return;
    }

    toast.success("Group deleted.");
    router.push("/admin/groups");
    router.refresh();
  }

  const saveButtonLabel = (() => {
    if (isSaving) {
      return isCreateMode ? "Creating…" : "Saving…";
    }
    return isCreateMode ? "Create group" : "Save changes";
  })();

  return (
    <>
      <WorkspacePageHeader
        description="Organize workspace members and manage access."
        icon={<UsersIcon className={workspacePageHeaderIconClassName} />}
        title={nameDraft.trim() || DEFAULT_CREATE_GROUP_NAME}
      />

      <div className="flex flex-col gap-5 [&_a]:cursor-pointer [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
        <SettingsCard
          action={
            <Input
              aria-label="Group name"
              className="h-8 w-36 rounded-lg"
              id="group-name"
              onChange={(event) => setNameDraft(event.target.value)}
              value={nameDraft}
            />
          }
          description="Choose a name your team will recognize."
          title="Group name"
        />

        <GroupMembersSection
          onAddMember={addMember}
          onRemoveMember={removeMember}
          pickerOptions={pickerOptions}
          selectedMembers={selectedMembers}
        />

        <div className="flex items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <WorkspacePageBackButton href="/admin/groups" label="Back" />
            <Button
              disabled={!hasPendingChanges || isSaving}
              onClick={() => {
                saveChanges().catch(() => undefined);
              }}
              size="sm"
              type="button"
            >
              {saveButtonLabel}
            </Button>
          </div>
          {isCreateMode ? null : (
            <Button
              className="bg-transparent hover:bg-muted/50"
              disabled={isDeleting || isSaving}
              onClick={() => setDeleteOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Delete group
            </Button>
          )}
        </div>
      </div>

      {isCreateMode ? null : (
        <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
          <AlertDialogContent className="[&_button]:cursor-pointer">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete group?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes {group.name} and removes all member
                assignments.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting} type="button">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeleting}
                onClick={(event) => {
                  event.preventDefault();
                  deleteGroup().catch(() => undefined);
                }}
                type="button"
              >
                {isDeleting ? "Deleting…" : "Delete group"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
