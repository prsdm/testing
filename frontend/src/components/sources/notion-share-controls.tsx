"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { NotionShareMemberOption } from "@/contracts/sources";
import { cn } from "@/shared/utils";

export type { NotionShareMemberOption } from "@/contracts/sources";

type NotionShareControlsProps = {
  selectedEmails: string[];
  onSelectedEmailsChange: (emails: string[]) => void;
  publishToWorkspace: boolean;
  onPublishToWorkspaceChange: (value: boolean) => void;
  members: NotionShareMemberOption[];
  viewerEmail: string;
  canPublishToWorkspace: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function NotionShareControls({
  selectedEmails,
  onSelectedEmailsChange,
  publishToWorkspace,
  onPublishToWorkspaceChange,
  members,
  viewerEmail,
  canPublishToWorkspace,
}: NotionShareControlsProps) {
  const [memberQuery, setMemberQuery] = useState("");
  const viewerEmailNormalized = normalizeEmail(viewerEmail);

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    return members.filter((member) => {
      if (normalizeEmail(member.email) === viewerEmailNormalized) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        member.email.toLowerCase().includes(query) ||
        member.displayName.toLowerCase().includes(query)
      );
    });
  }, [memberQuery, members, viewerEmailNormalized]);

  const selectedEmailSet = new Set(
    selectedEmails.map((email) => normalizeEmail(email))
  );

  function toggleMemberEmail(email: string) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return;
    }
    if (selectedEmailSet.has(normalized)) {
      onSelectedEmailsChange(
        selectedEmails.filter((entry) => normalizeEmail(entry) !== normalized)
      );
      return;
    }
    onSelectedEmailsChange([...selectedEmails, normalized]);
  }

  return (
    <fieldset className="mt-4 flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-3">
      <legend className="px-1 font-medium text-sm">Sharing in Kimi</legend>

      <p className="text-muted-foreground text-xs">
        Notion has no document ACL API. Sharing here only controls who can see
        this content inside Kimi — it does not change Notion permissions. By
        default only you can see indexed content; others get access if they
        index the same page too, unless you share below.
      </p>

      <div className="rounded-md border border-border/60 bg-background">
        <p className="border-border/60 border-b px-3 py-2 font-medium text-sm">
          Also share with teammates (optional)
        </p>
        <div className="relative border-border/60 border-b px-3 py-2">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-5 size-4 text-muted-foreground" />
          <Input
            className="h-8 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
            disabled={publishToWorkspace}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="Search teammates…"
            value={memberQuery}
          />
        </div>
        <div className="max-h-40 overflow-y-auto p-1">
          {filteredMembers.length === 0 ? (
            <p className="px-3 py-4 text-center text-muted-foreground text-xs">
              No teammates match your search.
            </p>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = selectedEmailSet.has(
                normalizeEmail(member.email)
              );
              const checkboxId = `notion-share-${member.id}`;
              return (
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/40",
                    isSelected && "bg-muted/50",
                    publishToWorkspace && "cursor-not-allowed opacity-60"
                  )}
                  htmlFor={checkboxId}
                  key={member.id}
                >
                  <input
                    checked={isSelected}
                    className="size-4 shrink-0"
                    disabled={publishToWorkspace}
                    id={checkboxId}
                    onChange={() => toggleMemberEmail(member.email)}
                    type="checkbox"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-sm">
                      {member.displayName}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      {member.email}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>
        <p className="border-border/60 border-t px-3 py-2 text-muted-foreground text-xs">
          Selected teammates can see this without indexing it themselves.
        </p>
      </div>

      {canPublishToWorkspace ? (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            checked={publishToWorkspace}
            className="mt-1"
            onChange={(event) => {
              onPublishToWorkspaceChange(event.target.checked);
            }}
            type="checkbox"
          />
          <span className="text-sm">
            <span className="font-medium">Share with whole workspace</span>
            <span className="mt-0.5 block text-muted-foreground text-xs">
              Everyone in your organization can see this in Kimi.
            </span>
          </span>
        </label>
      ) : null}
    </fieldset>
  );
}
