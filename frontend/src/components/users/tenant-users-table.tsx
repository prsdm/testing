"use client";

import {
  ChevronDown,
  MoreHorizontal,
  SearchIcon,
  UserCheck,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/chat/user-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TenantInviteButton } from "@/components/users/tenant-invite-panel";
import { TenantUsersCombinedFilter } from "@/components/users/tenant-users-faceted-filter";
import {
  TenantUsersPagination,
  USERS_PAGE_SIZE,
} from "@/components/users/tenant-users-pagination";
import type { TenantMemberRole } from "@/shared/users/tenant-member-role";
import { cn } from "@/shared/utils";

const ROLE_OPTIONS: Array<{
  value: TenantMemberRole;
  label: string;
}> = [
  { label: "Admin", value: "admin" },
  { label: "Basic", value: "basic" },
];

const roleRadioItemClassName =
  "rounded-lg pr-3 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden data-[state=checked]:bg-muted/50 data-[state=checked]:text-foreground data-[state=checked]:focus:bg-muted/50 data-[state=checked]:focus:text-foreground data-[state=checked]:[&_svg]:text-foreground";

const STATUS_FILTER_OPTIONS = [
  { label: "Active", value: "active" as const },
  { label: "Deactivated", value: "deactivated" as const },
  { label: "Invited", value: "invited" as const },
];

type StatusFilterValue = (typeof STATUS_FILTER_OPTIONS)[number]["value"];

export type PendingInviteRow = {
  id: string;
  email: string;
  role: TenantMemberRole;
  expiresAt: string;
  createdAt: string;
};

function memberDisplayName(member: TenantUserRow) {
  return member.displayName?.trim() || member.email.split("@")[0];
}

function memberStatus(member: TenantUserRow): StatusFilterValue {
  return member.isActive ? "active" : "deactivated";
}

export type TenantUserRow = {
  id: string;
  authUserId: string;
  email: string;
  role: TenantMemberRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  displayName: string | null;
  department: string | null;
  jobTitle: string | null;
  customRoleIds: string[];
};

export type TenantCustomRoleOption = {
  id: string;
  name: string;
};

function memberJobTitle(member: TenantUserRow) {
  return member.jobTitle?.trim() || "";
}

function memberDepartment(member: TenantUserRow) {
  return member.department?.trim() || "";
}

function formatLastLogin(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function memberSubtitle(member: TenantUserRow) {
  const parts = [member.email];

  const jobTitle = memberJobTitle(member);
  if (jobTitle) {
    parts.push(jobTitle);
  }

  if (!jobTitle) {
    const department = memberDepartment(member);
    if (department) {
      parts.push(department);
    }
  }

  if (member.lastLoginAt) {
    parts.push(`Last login: ${formatLastLogin(member.lastLoginAt)}`);
  }

  return parts.join(" · ");
}

function DeactivatedStatusChip() {
  return (
    <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-[10px] text-red-700 dark:bg-red-500/10 dark:text-red-400">
      Deactivated
    </span>
  );
}

function InvitedStatusChip() {
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      Invited
    </span>
  );
}

function UserStatusChip({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return null;
  }
  return <DeactivatedStatusChip />;
}

function inviteDisplayName(email: string) {
  return email.split("@")[0] || email;
}

function formatInviteExpiry(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function roleLabel(role: TenantMemberRole) {
  return role === "admin" ? "Admin" : "Basic";
}

function memberRoleSelection(
  member: TenantUserRow,
  customRoles: TenantCustomRoleOption[]
) {
  if (member.role === "admin") {
    return {
      label: "Admin",
      value: "admin" as const,
    };
  }

  const customRoleId = member.customRoleIds.at(0);
  const customRole = customRoleId
    ? customRoles.find((role) => role.id === customRoleId)
    : undefined;

  if (customRole) {
    return {
      label: customRole.name,
      value: `custom:${customRole.id}` as const,
    };
  }

  return {
    label: "Basic",
    value: "basic" as const,
  };
}

const userRoleColumnClassName = "flex min-h-8 min-w-[5.25rem] justify-end";

function CurrentUserRoleEnd({
  member,
  customRoles,
}: {
  member: TenantUserRow;
  customRoles: TenantCustomRoleOption[];
}) {
  const selection = memberRoleSelection(member, customRoles);

  return (
    <span
      className={cn(
        buttonVariants({ size: "sm", variant: "outline" }),
        "max-w-56 bg-transparent"
      )}
    >
      <span className="truncate">{selection.label}</span>
    </span>
  );
}

function UserRoleControl({
  member,
  customRoles,
  isPending,
  onUpdateMember,
}: {
  member: TenantUserRow;
  customRoles: TenantCustomRoleOption[];
  isPending: boolean;
  onUpdateMember: (
    memberId: string,
    patch: {
      role?: TenantMemberRole;
      isActive?: boolean;
      customRoleIds?: string[];
    }
  ) => Promise<void>;
}) {
  const selection = memberRoleSelection(member, customRoles);

  const roleTriggerClassName =
    "max-w-56 bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={roleTriggerClassName}
          disabled={isPending}
          size="sm"
          type="button"
          variant="outline"
        >
          <span className="truncate">{selection.label}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-32 **:data-[slot=dropdown-menu-radio-item]:cursor-pointer"
      >
        {" "}
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value === selection.value) {
              return;
            }

            if (value === "admin") {
              onUpdateMember(member.id, {
                customRoleIds: [],
                role: "admin",
              }).catch(() => undefined);
              return;
            }

            if (value === "basic") {
              onUpdateMember(member.id, {
                customRoleIds: [],
                role: "basic",
              }).catch(() => undefined);
              return;
            }

            if (value.startsWith("custom:")) {
              const customRoleId = value.slice("custom:".length);
              onUpdateMember(member.id, {
                customRoleIds: [customRoleId],
                role: "basic",
              }).catch(() => undefined);
            }
          }}
          value={selection.value}
        >
          {ROLE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              className={roleRadioItemClassName}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}

          {customRoles.length > 0 ? (
            <>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Custom roles
              </DropdownMenuLabel>
              {customRoles.map((role) => (
                <DropdownMenuRadioItem
                  className={roleRadioItemClassName}
                  key={role.id}
                  value={`custom:${role.id}`}
                >
                  {role.name}
                </DropdownMenuRadioItem>
              ))}
            </>
          ) : null}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function YouChip() {
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      You
    </span>
  );
}

function UserActionsMenu({
  member,
  isPending,
  onUpdateMember,
}: {
  member: TenantUserRow;
  isPending: boolean;
  onUpdateMember: (
    memberId: string,
    patch: {
      role?: TenantMemberRole;
      isActive?: boolean;
      customRoleIds?: string[];
    }
  ) => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="bg-transparent hover:bg-muted/50"
          disabled={isPending}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <MoreHorizontal />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-0 **:data-[slot=dropdown-menu-item]:cursor-pointer"
      >
        {member.isActive ? (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              onUpdateMember(member.id, { isActive: false }).catch(
                () => undefined
              );
            }}
            variant="destructive"
          >
            <UserX />
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-green-600 focus:bg-green-500/10 focus:text-green-600"
            onClick={() => {
              onUpdateMember(member.id, { isActive: true }).catch(
                () => undefined
              );
            }}
          >
            <UserCheck />
            Activate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InviteListRow({
  invite,
  isPending,
  onRevoke,
}: {
  invite: PendingInviteRow;
  isPending: boolean;
  onRevoke: (inviteId: string) => Promise<void>;
}) {
  const name = inviteDisplayName(invite.email);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar
          className="size-10 shrink-0 rounded-lg"
          email={invite.email}
          name={name}
          size="md"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{name}</span>
            <InvitedStatusChip />
          </span>
          <span className="block truncate text-[13px] text-muted-foreground leading-snug">
            {invite.email} · {roleLabel(invite.role)} · Expires{" "}
            {formatInviteExpiry(invite.expiresAt)}
          </span>
        </span>
      </span>

      <div className="grid shrink-0 grid-cols-[auto_auto] items-center gap-1.5 [&_button]:cursor-pointer **[data-[slot=dropdown-menu-item]]:cursor-pointer">
        <div className={userRoleColumnClassName}>
          <span
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "max-w-56 bg-transparent text-muted-foreground"
            )}
          >
            <span className="truncate">{roleLabel(invite.role)}</span>
          </span>
        </div>
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="bg-transparent hover:bg-muted/50"
                disabled={isPending}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <MoreHorizontal />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-auto min-w-0 **:data-[slot=dropdown-menu-item]:cursor-pointer"
            >
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  onRevoke(invite.id).catch(() => undefined);
                }}
                variant="destructive"
              >
                <UserX />
                Revoke invite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function UserListRow({
  member,
  customRoles,
  isCurrentUser,
  isPending,
  onUpdateMember,
}: {
  member: TenantUserRow;
  customRoles: TenantCustomRoleOption[];
  isCurrentUser: boolean;
  isPending: boolean;
  onUpdateMember: (
    memberId: string,
    patch: {
      role?: TenantMemberRole;
      isActive?: boolean;
      customRoleIds?: string[];
    }
  ) => Promise<void>;
}) {
  const name = memberDisplayName(member);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar
          className="size-10 shrink-0 rounded-lg"
          email={member.email}
          name={name}
          size="md"
          userId={member.authUserId}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{name}</span>
            {isCurrentUser ? <YouChip /> : null}
            <UserStatusChip isActive={member.isActive} />
          </span>
          <span className="block truncate text-[13px] text-muted-foreground leading-snug">
            {memberSubtitle(member)}
          </span>
        </span>
      </span>

      <div className="grid shrink-0 grid-cols-[auto_auto] items-center gap-1.5 [&_button]:cursor-pointer **[data-[slot=dropdown-menu-item]]:cursor-pointer **[data-[slot=dropdown-menu-radio-item]]:cursor-pointer">
        <div className={userRoleColumnClassName}>
          {isCurrentUser ? null : (
            <UserRoleControl
              customRoles={customRoles}
              isPending={isPending}
              member={member}
              onUpdateMember={onUpdateMember}
            />
          )}
        </div>
        <div className="flex justify-end">
          {isCurrentUser ? (
            <CurrentUserRoleEnd customRoles={customRoles} member={member} />
          ) : (
            <UserActionsMenu
              isPending={isPending}
              member={member}
              onUpdateMember={onUpdateMember}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function TenantUsersTable({
  initialMembers,
  initialInvites,
  customRoles,
  tenantSlug,
  currentUserId,
}: {
  initialMembers: TenantUserRow[];
  initialInvites: PendingInviteRow[];
  customRoles: TenantCustomRoleOption[];
  tenantSlug: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<TenantMemberRole>>(
    () => new Set()
  );
  const [selectedStatuses, setSelectedStatuses] = useState<
    Set<StatusFilterValue>
  >(() => new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    setInvites(initialInvites);
  }, [initialInvites]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows: Array<
      | { kind: "member"; member: TenantUserRow }
      | { kind: "invite"; invite: PendingInviteRow }
    > = [];

    const includeMembers =
      selectedStatuses.size === 0 ||
      selectedStatuses.has("active") ||
      selectedStatuses.has("deactivated");
    const includeInvites =
      selectedStatuses.size === 0 || selectedStatuses.has("invited");

    if (includeMembers) {
      for (const member of members) {
        if (query) {
          const name = memberDisplayName(member).toLowerCase();
          const email = member.email.toLowerCase();
          const jobTitle = memberJobTitle(member).toLowerCase();
          const department = memberDepartment(member).toLowerCase();
          if (
            !name.includes(query) &&
            !email.includes(query) &&
            !jobTitle.includes(query) &&
            !department.includes(query)
          ) {
            continue;
          }
        }

        if (selectedRoles.size > 0 && !selectedRoles.has(member.role)) {
          continue;
        }

        if (
          selectedStatuses.size > 0 &&
          !selectedStatuses.has(memberStatus(member))
        ) {
          continue;
        }

        rows.push({ kind: "member", member });
      }
    }

    if (includeInvites) {
      for (const invite of invites) {
        if (query) {
          const name = inviteDisplayName(invite.email).toLowerCase();
          const email = invite.email.toLowerCase();
          if (!name.includes(query) && !email.includes(query)) {
            continue;
          }
        }

        if (selectedRoles.size > 0 && !selectedRoles.has(invite.role)) {
          continue;
        }

        if (selectedStatuses.size > 0 && !selectedStatuses.has("invited")) {
          continue;
        }

        rows.push({ invite, kind: "invite" });
      }
    }

    rows.sort((a, b) => {
      const aIsYou =
        a.kind === "member" && a.member.authUserId === currentUserId;
      const bIsYou =
        b.kind === "member" && b.member.authUserId === currentUserId;
      if (aIsYou === bIsYou) {
        return 0;
      }
      return aIsYou ? -1 : 1;
    });

    return rows;
  }, [
    members,
    invites,
    searchQuery,
    selectedRoles,
    selectedStatuses,
    currentUserId,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / USERS_PAGE_SIZE)
  );
  const showPagination = filteredRows.length > USERS_PAGE_SIZE;

  const paginatedRows = useMemo(() => {
    if (!showPagination) {
      return filteredRows;
    }

    const start = (page - 1) * USERS_PAGE_SIZE;
    return filteredRows.slice(start, start + USERS_PAGE_SIZE);
  }, [filteredRows, page, showPagination]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const roleFilterOptions = ROLE_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }));

  const updateMember = async (
    memberId: string,
    patch: {
      role?: TenantMemberRole;
      isActive?: boolean;
      customRoleIds?: string[];
    }
  ) => {
    setPendingId(memberId);
    const response = await fetch(`/api/users/${tenantSlug}/${memberId}`, {
      body: JSON.stringify(patch),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to update user.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as {
      member?: { customRoleIds?: string[] };
    } | null;

    setMembers((current) =>
      current.map((member) =>
        member.id === memberId
          ? {
              ...member,
              customRoleIds:
                payload?.member?.customRoleIds ??
                patch.customRoleIds ??
                (patch.role === "admin" ? [] : member.customRoleIds),
              isActive: patch.isActive ?? member.isActive,
              role: patch.role ?? member.role,
            }
          : member
      )
    );
    toast.success("User updated.");
    router.refresh();
  };

  const revokeInvite = async (inviteId: string) => {
    setPendingId(inviteId);
    const response = await fetch(
      `/api/users/${tenantSlug}/invites?inviteId=${encodeURIComponent(inviteId)}`,
      { method: "DELETE" }
    );
    setPendingId(null);

    if (!response.ok) {
      toast.error("Could not revoke invite");
      return;
    }

    setInvites((current) => current.filter((invite) => invite.id !== inviteId));
    toast.success("Invite revoked");
    router.refresh();
  };

  const hasAnyPeople = members.length > 0 || invites.length > 0;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 rounded-lg bg-transparent pl-9"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search users…"
              value={searchQuery}
            />
          </div>
          <TenantUsersCombinedFilter
            onSelectedRolesChange={(values) => {
              setSelectedRoles(values);
              setPage(1);
            }}
            onSelectedStatusesChange={(values) => {
              setSelectedStatuses(values);
              setPage(1);
            }}
            roleOptions={roleFilterOptions}
            selectedRoles={selectedRoles}
            selectedStatuses={selectedStatuses}
            statusOptions={STATUS_FILTER_OPTIONS}
          />
          <div className="ml-auto">
            <TenantInviteButton tenantSlug={tenantSlug} />
          </div>
        </div>

        {hasAnyPeople ? (
          filteredRows.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              No users match your filters.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/60">
              {paginatedRows.map((row, index) => (
                <div
                  className={
                    index < paginatedRows.length - 1
                      ? "border-border/60 border-b"
                      : undefined
                  }
                  key={row.kind === "member" ? row.member.id : row.invite.id}
                >
                  {row.kind === "member" ? (
                    <UserListRow
                      customRoles={customRoles}
                      isCurrentUser={row.member.authUserId === currentUserId}
                      isPending={pendingId === row.member.id}
                      member={row.member}
                      onUpdateMember={updateMember}
                    />
                  ) : (
                    <InviteListRow
                      invite={row.invite}
                      isPending={pendingId === row.invite.id}
                      onRevoke={revokeInvite}
                    />
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="text-muted-foreground text-sm">
            No one has signed in yet. Invite teammates, or they&apos;ll appear
            here after their first login.
          </p>
        )}

        {showPagination ? (
          <TenantUsersPagination
            align="center"
            currentPage={page}
            onPageChange={setPage}
            totalPages={totalPages}
          />
        ) : null}
      </div>
    </section>
  );
}
