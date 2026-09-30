"use client";

import {
  MoreHorizontal,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import { McpIcon } from "@/components/icons/mcp-icon";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mcpServerListSubtitle } from "@/shared/mcp/server-list-subtitle";
import { cn } from "@/shared/utils";

export type TenantMcpServerAdminRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  serverUrl: string;
  transport: "sse" | "streamable_http";
  authMode: "none" | "bearer";
  hasAuthToken: boolean;
  isEnabled: boolean;
  connectionsCount: number;
};

type ServerDraft = {
  name: string;
  description: string;
  serverUrl: string;
  transport: "sse" | "streamable_http";
  authMode: "none" | "bearer";
  authToken: string;
  isEnabled: boolean;
};

type McpToolSummary = {
  name: string;
  description: string;
};

type McpToolsLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tools: McpToolSummary[] };

function McpServerLogo() {
  return (
    <AdminListItemLogoFrame className="text-muted-foreground">
      <McpIcon className="size-full max-h-6 max-w-6" />
    </AdminListItemLogoFrame>
  );
}

function McpEnabledChip({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        Enabled
      </span>
    );
  }
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
      Disabled
    </span>
  );
}

function McpServerToolsList({
  tenantSlug,
  serverId,
}: {
  tenantSlug: string;
  serverId: string;
}) {
  const [loadState, setLoadState] = useState<McpToolsLoadState>({
    status: "idle",
  });

  const loadTools = useCallback(async () => {
    setLoadState({ status: "loading" });
    const response = await fetch(
      `/api/admin/${tenantSlug}/mcp-servers/${serverId}/tools`,
      { credentials: "include" }
    );
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      tools?: McpToolSummary[];
      error?: string;
    } | null;
    if (!response.ok || !payload?.ok || !payload.tools) {
      setLoadState({
        message: payload?.error ?? "Could not load tools from this server.",
        status: "error",
      });
      return;
    }
    setLoadState({ status: "ready", tools: payload.tools });
  }, [serverId, tenantSlug]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  if (loadState.status === "loading" || loadState.status === "idle") {
    return (
      <p className="text-muted-foreground text-xs">Loading available tools…</p>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">{loadState.message}</p>
        <Button
          onClick={() => void loadTools()}
          size="sm"
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (loadState.tools.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No tools reported by this server.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-border/60 border-t pt-4">
      <p className="font-medium text-[13px]">
        Available tools ({loadState.tools.length})
      </p>
      <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
        {loadState.tools.map((tool) => (
          <li
            className="rounded-md border border-border/50 bg-muted/20 px-3 py-2"
            key={tool.name}
          >
            <p className="font-mono text-[13px] text-foreground">{tool.name}</p>
            {tool.description ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
                {tool.description}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function McpServerRow({
  server,
  isTesting,
  onEdit,
  onTest,
  onDelete,
}: {
  server: TenantMcpServerAdminRow;
  isTesting: boolean;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const subtitle = mcpServerListSubtitle({
    connectionsCount: server.connectionsCount,
    description: server.description,
    serverUrl: server.serverUrl,
    transport: server.transport,
  });

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <McpServerLogo />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{server.name}</span>
            <McpEnabledChip enabled={server.isEnabled} />
          </div>
          <p className="truncate text-[13px] text-muted-foreground leading-snug">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center [&_button]:cursor-pointer **[data-[slot=dropdown-menu-item]]:cursor-pointer">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="bg-transparent hover:bg-muted/50"
              disabled={isTesting}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <MoreHorizontal />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-0">
            <DropdownMenuItem disabled={isTesting} onClick={() => onTest()}>
              <PlayIcon />
              {isTesting ? "Testing…" : "Test connection"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit()}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete()}
              variant="destructive"
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

const emptyDraft = (): ServerDraft => ({
  authMode: "none",
  authToken: "",
  description: "",
  isEnabled: true,
  name: "",
  serverUrl: "",
  transport: "sse",
});

export function TenantMcpServersAdmin({
  tenantSlug,
  initialServers,
}: {
  tenantSlug: string;
  initialServers: TenantMcpServerAdminRow[];
}) {
  const [servers, setServers] = useState(initialServers);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServerDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<TenantMcpServerAdminRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toolsRefreshKey, setToolsRefreshKey] = useState(0);

  useEffect(() => {
    setServers(initialServers);
  }, [initialServers]);

  const filteredServers = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return servers;
    }
    return servers.filter((server) => {
      const haystack = [
        server.name,
        server.description ?? "",
        server.serverUrl,
        server.slug,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [searchQuery, servers]);

  function openCreateDialog() {
    setEditingServerId(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  }

  function openEditDialog(server: TenantMcpServerAdminRow) {
    setEditingServerId(server.id);
    setDraft({
      authMode: server.authMode,
      authToken: "",
      description: server.description ?? "",
      isEnabled: server.isEnabled,
      name: server.name,
      serverUrl: server.serverUrl,
      transport: server.transport,
    });
    setToolsRefreshKey((current) => current + 1);
    setDialogOpen(true);
  }

  function closeServerDialog() {
    setDialogOpen(false);
    setEditingServerId(null);
    setDraft(emptyDraft());
  }

  async function saveServer() {
    setIsSaving(true);
    const isEdit = editingServerId !== null;
    const body: Record<string, unknown> = {
      authMode: draft.authMode,
      description: draft.description || null,
      name: draft.name,
      serverUrl: draft.serverUrl,
      transport: draft.transport,
    };
    if (!isEdit) {
      body.isEnabled = draft.isEnabled;
      if (draft.authMode === "bearer" && draft.authToken.trim()) {
        body.authToken = draft.authToken.trim();
      }
    } else if (draft.authMode === "bearer" && draft.authToken.trim()) {
      body.authToken = draft.authToken.trim();
    } else if (draft.authMode === "none") {
      body.clearAuthToken = true;
    }

    const response = await fetch(
      isEdit
        ? `/api/admin/${tenantSlug}/mcp-servers/${editingServerId}`
        : `/api/admin/${tenantSlug}/mcp-servers`,
      {
        body: JSON.stringify(body),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: isEdit ? "PATCH" : "POST",
      }
    );
    setIsSaving(false);
    if (!response.ok) {
      toast.error(
        isEdit ? "Failed to update MCP server." : "Failed to create MCP server."
      );
      return;
    }
    const payload = (await response.json()) as {
      server: TenantMcpServerAdminRow;
    };
    setServers((current) =>
      isEdit
        ? current.map((entry) =>
            entry.id === payload.server.id ? payload.server : entry
          )
        : [payload.server, ...current]
    );
    if (isEdit) {
      setToolsRefreshKey((current) => current + 1);
    }
    closeServerDialog();
    toast.success(isEdit ? "MCP server updated." : "MCP server added.");
  }

  async function deleteServer(server: TenantMcpServerAdminRow) {
    setIsDeleting(true);
    const response = await fetch(
      `/api/admin/${tenantSlug}/mcp-servers/${server.id}`,
      { credentials: "include", method: "DELETE" }
    );
    setIsDeleting(false);
    if (!response.ok) {
      toast.error("Failed to delete MCP server.");
      return;
    }
    setServers((current) => current.filter((entry) => entry.id !== server.id));
    setDeleteTarget(null);
    toast.success("MCP server removed.");
  }

  async function testServer(serverId: string) {
    setTestingId(serverId);
    const response = await fetch(
      `/api/admin/${tenantSlug}/mcp-servers/${serverId}/test`,
      { credentials: "include", method: "POST" }
    );
    setTestingId(null);
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      toolCount?: number;
      error?: string;
    } | null;
    if (!response.ok || !payload?.ok) {
      toast.error(payload?.error ?? "Could not reach MCP server.");
      return;
    }
    setToolsRefreshKey((current) => current + 1);
    toast.success(`Connected — ${payload.toolCount ?? 0} tools discovered.`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 rounded-lg bg-transparent pl-9"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search MCP servers…"
            value={searchQuery}
          />
        </div>
        <Button onClick={openCreateDialog} size="sm" type="button">
          <PlusIcon />
          MCP server
        </Button>
      </div>

      {servers.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No MCP servers yet. Add one to make tools available on Connectors.
        </p>
      ) : filteredServers.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No MCP servers match your search.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {filteredServers.map((server, index) => (
            <div
              className={cn(index > 0 && "border-border/60 border-t")}
              key={server.id}
            >
              <McpServerRow
                isTesting={testingId === server.id}
                onDelete={() => setDeleteTarget(server)}
                onEdit={() => openEditDialog(server)}
                onTest={() => void testServer(server.id)}
                server={server}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeServerDialog();
            return;
          }
          setDialogOpen(true);
        }}
        open={dialogOpen}
      >
        <DialogContent className="[&_button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle>
              {editingServerId ? "Edit MCP server" : "Add MCP server"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="mcp-name">Name</Label>
              <Input
                id="mcp-name"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={draft.name}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mcp-url">Server URL</Label>
              <Input
                id="mcp-url"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    serverUrl: event.target.value,
                  }))
                }
                placeholder="https://example.com/mcp/sse"
                value={draft.serverUrl}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mcp-description">Description</Label>
              <Input
                id="mcp-description"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={draft.description}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Transport</Label>
              <Select
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    transport: value as ServerDraft["transport"],
                  }))
                }
                value={draft.transport}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sse">SSE</SelectItem>
                  <SelectItem value="streamable_http">
                    Streamable HTTP
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Auth</Label>
              <Select
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    authMode: value as ServerDraft["authMode"],
                  }))
                }
                value={draft.authMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.authMode === "bearer" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="mcp-token">Bearer token</Label>
                <Input
                  id="mcp-token"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      authToken: event.target.value,
                    }))
                  }
                  placeholder={
                    editingServerId
                      ? "Leave blank to keep the current token"
                      : undefined
                  }
                  type="password"
                  value={draft.authToken}
                />
              </div>
            ) : null}
            {editingServerId ? (
              <McpServerToolsList
                key={`tools-${editingServerId}-${toolsRefreshKey}`}
                serverId={editingServerId}
                tenantSlug={tenantSlug}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button
              disabled={
                isSaving || !draft.name.trim() || !draft.serverUrl.trim()
              }
              onClick={() => void saveServer()}
              type="button"
            >
              {isSaving ? "Saving…" : editingServerId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={deleteTarget !== null}
      >
        <AlertDialogContent className="[&_button]:cursor-pointer">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MCP server?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be removed for everyone. Members who connected it will lose access in chat.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} type="button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting || !deleteTarget}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) {
                  void deleteServer(deleteTarget);
                }
              }}
              type="button"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
