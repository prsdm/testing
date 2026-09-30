"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/chat/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ChannelMember,
  ChannelMemberPickerOption,
} from "@/contracts/channels";

const SEARCH_LIMIT = 25;

export function ChannelMembersSection({
  tenantSlug,
  channelId,
  onMembersChanged,
}: {
  tenantSlug: string;
  channelId: string;
  onMembersChanged?: () => void;
}) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [pickerOptions, setPickerOptions] = useState<
    ChannelMemberPickerOption[]
  >([]);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [query, setQuery] = useState("");

  const membersApiUrl = `${process.env.KIMIRO_BASE_PATH ?? ""}/api/channels/${tenantSlug}/${channelId}/members`;

  const loadMembers = useCallback(async () => {
    try {
      const response = await fetch(membersApiUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load members");
      }
      const payload = (await response.json()) as {
        members: ChannelMember[];
        pickerOptions: ChannelMemberPickerOption[];
        canManageMembers: boolean;
      };
      setMembers(payload.members);
      setPickerOptions(payload.pickerOptions);
      setCanManageMembers(payload.canManageMembers);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load members"
      );
    }
  }, [membersApiUrl]);

  useEffect(() => {
    loadMembers().catch(() => undefined);
  }, [loadMembers]);

  const memberIds = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members]
  );

  const pickerMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }
    return pickerOptions
      .filter(
        (option) =>
          !memberIds.has(option.userId) &&
          (option.email.toLowerCase().includes(normalized) ||
            option.displayName.toLowerCase().includes(normalized))
      )
      .slice(0, SEARCH_LIMIT);
  }, [memberIds, pickerOptions, query]);

  async function addMember(userId: string) {
    try {
      const response = await fetch(membersApiUrl, {
        body: JSON.stringify({ userId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to add member");
      }
      setQuery("");
      await loadMembers();
      onMembersChanged?.();
      toast.success("Member added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add member"
      );
    }
  }

  async function removeMember(userId: string) {
    try {
      const response = await fetch(
        `${membersApiUrl}?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("Failed to remove member");
      }
      await loadMembers();
      onMembersChanged?.();
      toast.success("Member removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canManageMembers ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspace members to add…"
              value={query}
            />
          </div>
          {query.trim() ? (
            <ul className="no-scrollbar max-h-32 space-y-1 overflow-y-auto">
              {pickerMatches.map((option) => (
                <li key={option.userId}>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                    onClick={() => {
                      addMember(option.userId).catch(() => undefined);
                    }}
                    type="button"
                  >
                    <UserAvatar
                      email={option.email}
                      image={option.image}
                      name={option.displayName}
                      size="sm"
                    />
                    <span className="truncate text-sm">
                      {option.displayName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ul className="no-scrollbar max-h-48 space-y-2 overflow-y-auto">
        {members.map((member) => (
          <li className="flex items-center gap-2" key={member.userId}>
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
            <span className="text-muted-foreground text-xs capitalize">
              {member.role}
            </span>
            {canManageMembers && member.role === "member" ? (
              <Button
                onClick={() => {
                  removeMember(member.userId).catch(() => undefined);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
