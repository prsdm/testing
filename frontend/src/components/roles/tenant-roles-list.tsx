"use client";

import {
  MoreHorizontal,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TenantUsersPagination } from "@/components/users/tenant-users-pagination";
import {
  BASIC_DEFAULT_CAPABILITIES,
  CAPABILITY_CATALOG,
  CAPABILITY_GROUPS,
  CAPABILITY_IDS,
  type CapabilityId,
} from "@/shared/auth/capabilities";
import { cn } from "@/shared/utils";

const ROLES_PAGE_SIZE = 8;

export type CustomRoleListRow = {
  id: string;
  name: string;
  description: string | null;
  capabilityIds: CapabilityId[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

type PresetRoleId = "admin" | "basic";

type RoleListItem =
  | {
      kind: "preset";
      id: PresetRoleId;
      name: string;
      description: string;
      memberCount: number;
      capabilityIds: CapabilityId[];
      memberAccessNotes?: string[];
    }
  | {
      kind: "custom";
      id: string;
      name: string;
      description: string;
      memberCount: number;
      capabilityIds: CapabilityId[];
      memberAccessNotes?: string[];
    };

function PresetBadge() {
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      Preset
    </span>
  );
}

function RoleLetterAvatar({ name }: { name: string }) {
  const letter = (name.trim().at(0) ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-medium text-muted-foreground text-sm"
    >
      {letter}
    </span>
  );
}

function capabilityLabel(id: CapabilityId) {
  return CAPABILITY_CATALOG.find((entry) => entry.id === id)?.label ?? id;
}

function capabilitySetsEqual(left: CapabilityId[], right: CapabilityId[]) {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left);
  return right.every((id) => leftSet.has(id));
}

function CreateRoleDialog({
  open,
  onOpenChange,
  tenantSlug,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  onCreated: (role: CustomRoleListRow) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  async function createRole() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Role name is required.");
      return;
    }

    setIsCreating(true);
    const response = await fetch(`/api/admin/${tenantSlug}/roles`, {
      body: JSON.stringify({
        capabilityIds: [],
        description: description.trim() || null,
        name: trimmedName,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setIsCreating(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to create role.");
      return;
    }

    const created = (await response.json()) as CustomRoleListRow;
    onCreated(created);
    onOpenChange(false);
    toast.success("Role created.");
  }

  const isCreateDisabled = isCreating || !name.trim();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-md [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 py-5">
          <DialogTitle className="font-medium text-base leading-normal">
            Create role
          </DialogTitle>
        </DialogHeader>

        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col gap-4 px-6 py-6">
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-sm" htmlFor="create-role-name">
              Name
            </label>
            <Input
              autoComplete="off"
              className="rounded-lg"
              id="create-role-name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isCreateDisabled) {
                  event.preventDefault();
                  createRole().catch(() => undefined);
                }
              }}
              placeholder="Role name"
              value={name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="font-medium text-sm"
              htmlFor="create-role-description"
            >
              Description
            </label>
            <Textarea
              className="min-h-20 rounded-lg"
              id="create-role-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe this role (optional)"
              value={description}
            />
          </div>
        </div>

        <div className="mx-6 h-px bg-border/60" />

        <DialogFooter className="gap-2 px-6 py-4 sm:justify-end">
          <Button
            disabled={isCreating}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isCreateDisabled}
            onClick={() => {
              createRole().catch(() => undefined);
            }}
            type="button"
          >
            {isCreating ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagePermissionsDialog({
  open,
  onOpenChange,
  tenantSlug,
  role,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  role: RoleListItem | null;
  onSaved: (roleId: string, capabilityIds: CapabilityId[]) => void;
}) {
  const [selectedCapabilities, setSelectedCapabilities] = useState<
    CapabilityId[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && role) {
      setSelectedCapabilities(role.capabilityIds);
    }
  }, [open, role]);

  const readOnly = role?.kind === "preset";
  const isDirty =
    role !== null &&
    !capabilitySetsEqual(selectedCapabilities, role.capabilityIds);

  const groupedCatalog = useMemo(
    () =>
      CAPABILITY_GROUPS.map((group) => ({
        ...group,
        items: CAPABILITY_CATALOG.filter((item) => item.group === group.id),
      })),
    []
  );

  function toggleCapability(capabilityId: CapabilityId) {
    if (readOnly) {
      return;
    }
    setSelectedCapabilities((current) =>
      current.includes(capabilityId)
        ? current.filter((id) => id !== capabilityId)
        : [...current, capabilityId]
    );
  }

  async function savePermissions() {
    if (role?.kind !== "custom" || !isDirty) {
      return;
    }

    setIsSaving(true);
    const response = await fetch(`/api/admin/${tenantSlug}/roles/${role.id}`, {
      body: JSON.stringify({ capabilityIds: selectedCapabilities }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    setIsSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to save permissions.");
      return;
    }

    const updated = (await response.json()) as CustomRoleListRow;
    onSaved(updated.id, updated.capabilityIds);
    onOpenChange(false);
    toast.success("Permissions saved.");
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-lg [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 py-5">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="font-medium text-base leading-normal">
              Manage permissions
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              {role
                ? `Choose what ${role.name} can do in admin and the app.`
                : "Choose permissions for this role."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col gap-4 px-6 py-6">
          {role?.memberAccessNotes && role.memberAccessNotes.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Included for all members
              </h3>
              <ul className="flex flex-col gap-1">
                {role.memberAccessNotes.map((note) => (
                  <li className="rounded-lg px-3 py-2.5 text-sm" key={note}>
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {readOnly ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-sm">Role permissions</h3>
              <ul className="flex flex-col gap-1">
                {role?.capabilityIds.map((id) => (
                  <li
                    className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm"
                    key={id}
                  >
                    {capabilityLabel(id)}
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-muted-foreground">
                Preset roles can’t be edited. Create a custom role to choose
                permissions.
              </p>
            </section>
          ) : (
            groupedCatalog.map((group) => (
              <section className="flex flex-col gap-2" key={group.id}>
                <h3 className="font-medium text-sm">{group.label}</h3>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const checked = selectedCapabilities.includes(item.id);
                    return (
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                          checked
                            ? "bg-muted/50 text-foreground"
                            : "text-foreground hover:bg-background/70"
                        )}
                        key={item.id}
                      >
                        <input
                          checked={checked}
                          className="mt-1 size-4 shrink-0 cursor-pointer rounded border-border accent-foreground"
                          onChange={() => toggleCapability(item.id)}
                          type="checkbox"
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium text-sm">
                            {item.label}
                          </span>
                          <span className="text-[13px] text-muted-foreground leading-snug">
                            {item.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="mx-6 h-px bg-border/60" />

        <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
          <p className="text-[13px] text-muted-foreground">
            {readOnly
              ? `${role?.capabilityIds.length ?? 0} permissions`
              : `${selectedCapabilities.length} selected`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {readOnly ? null : (
              <Button
                disabled={!isDirty || isSaving}
                onClick={() => {
                  savePermissions().catch(() => undefined);
                }}
                type="button"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleRow({
  role,
  onDelete,
  onManagePermissions,
}: {
  role: RoleListItem;
  onDelete: (role: Extract<RoleListItem, { kind: "custom" }>) => void;
  onManagePermissions: (role: RoleListItem) => void;
}) {
  const isPreset = role.kind === "preset";

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <RoleLetterAvatar name={role.name} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{role.name}</span>
            {isPreset ? <PresetBadge /> : null}
          </div>
          <p className="truncate text-[13px] text-muted-foreground leading-snug">
            {role.description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 [&_button]:cursor-pointer **[data-[slot=dropdown-menu-item]]:cursor-pointer">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="bg-transparent hover:bg-muted/50"
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <MoreHorizontal />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-0">
            <DropdownMenuItem onClick={() => onManagePermissions(role)}>
              <PencilIcon />
              Permissions
            </DropdownMenuItem>
            {isPreset ? null : (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() =>
                  onDelete(role as Extract<RoleListItem, { kind: "custom" }>)
                }
                variant="destructive"
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function TenantRolesList({
  tenantSlug,
  initialRoles,
  adminMemberCount,
  basicMemberCount,
}: {
  tenantSlug: string;
  initialRoles: CustomRoleListRow[];
  adminMemberCount: number;
  basicMemberCount: number;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionsRole, setPermissionsRole] = useState<RoleListItem | null>(
    null
  );
  const [roleToDelete, setRoleToDelete] = useState<Extract<
    RoleListItem,
    { kind: "custom" }
  > | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles]);

  const allRoles = useMemo<RoleListItem[]>(() => {
    const presets: RoleListItem[] = [
      {
        capabilityIds: [...CAPABILITY_IDS],
        description:
          "Full access to the admin console and all app permissions.",
        id: "admin",
        kind: "preset",
        memberCount: adminMemberCount,
        name: "Admin",
      },
      {
        capabilityIds: [...BASIC_DEFAULT_CAPABILITIES],
        description:
          "Use chat, connectors, and sources. No admin console by default.",
        id: "basic",
        kind: "preset",
        memberAccessNotes: [
          "Use chat",
          "Connect and use connectors",
          "Browse and use sources",
        ],
        memberCount: basicMemberCount,
        name: "Basic",
      },
    ];

    const custom: RoleListItem[] = roles.map((role) => ({
      capabilityIds: role.capabilityIds,
      description:
        role.description?.trim() || "Custom role with selected permissions.",
      id: role.id,
      kind: "custom",
      memberCount: role.memberCount,
      name: role.name,
    }));

    return [...presets, ...custom];
  }, [adminMemberCount, basicMemberCount, roles]);

  const filteredRoles = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return allRoles;
    }
    return allRoles.filter(
      (role) =>
        role.name.toLowerCase().includes(normalized) ||
        role.description.toLowerCase().includes(normalized)
    );
  }, [allRoles, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRoles.length / ROLES_PAGE_SIZE)
  );
  const showPagination = filteredRoles.length > ROLES_PAGE_SIZE;

  const paginatedRoles = useMemo(() => {
    if (!showPagination) {
      return filteredRoles;
    }
    const start = (page - 1) * ROLES_PAGE_SIZE;
    return filteredRoles.slice(start, start + ROLES_PAGE_SIZE);
  }, [filteredRoles, page, showPagination]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function deleteRole() {
    if (!roleToDelete) {
      return;
    }

    setIsDeleting(true);
    const response = await fetch(
      `/api/admin/${tenantSlug}/roles/${roleToDelete.id}`,
      { method: "DELETE" }
    );
    setIsDeleting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to delete role.");
      return;
    }

    setRoles((current) =>
      current.filter((role) => role.id !== roleToDelete.id)
    );
    setRoleToDelete(null);
    toast.success("Role deleted.");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 rounded-lg bg-transparent pl-9"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search roles…"
              value={searchQuery}
            />
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
            <PlusIcon />
            Create role
          </Button>
        </div>

        {filteredRoles.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No roles match your search.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            {paginatedRoles.map((role, index) => (
              <div
                className={cn(index > 0 && "border-border/60 border-t")}
                key={`${role.kind}-${role.id}`}
              >
                <RoleRow
                  onDelete={setRoleToDelete}
                  onManagePermissions={setPermissionsRole}
                  role={role}
                />
              </div>
            ))}
          </div>
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

      <CreateRoleDialog
        onCreated={(created) => {
          setRoles((current) =>
            [...current, created].sort((left, right) =>
              left.name.localeCompare(right.name)
            )
          );
          setPermissionsRole({
            capabilityIds: created.capabilityIds,
            description:
              created.description?.trim() ||
              "Custom role with selected permissions.",
            id: created.id,
            kind: "custom",
            memberCount: created.memberCount,
            name: created.name,
          });
          router.refresh();
        }}
        onOpenChange={setCreateOpen}
        open={createOpen}
        tenantSlug={tenantSlug}
      />

      <ManagePermissionsDialog
        onOpenChange={(open) => {
          if (!open) {
            setPermissionsRole(null);
          }
        }}
        onSaved={(roleId, capabilityIds) => {
          setRoles((current) =>
            current.map((role) =>
              role.id === roleId ? { ...role, capabilityIds } : role
            )
          );
          router.refresh();
        }}
        open={permissionsRole !== null}
        role={permissionsRole}
        tenantSlug={tenantSlug}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setRoleToDelete(null);
          }
        }}
        open={roleToDelete !== null}
      >
        <AlertDialogContent className="[&_button]:cursor-pointer">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {roleToDelete?.name} and removes it from
              all members.
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
                deleteRole().catch(() => undefined);
              }}
              type="button"
            >
              {isDeleting ? "Deleting…" : "Delete role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
