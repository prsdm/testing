"use client";

import {
  Loader2Icon,
  MoreHorizontal,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  NotionIndexShareDialog,
  type NotionIndexShareSettings,
} from "@/components/sources/notion-index-share-dialog";
import type { NotionShareMemberOption } from "@/components/sources/notion-share-controls";
import { KbCatalogRowDetailsPopover } from "@/components/sources/source-catalog-row-details-popover";
import { KbSourceIcon } from "@/components/sources/source-icon";
import { KbStatusPill } from "@/components/sources/source-status-pill";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TenantUsersFacetedFilter } from "@/components/users/tenant-users-faceted-filter";
import { TenantUsersPagination } from "@/components/users/tenant-users-pagination";
import type { SourceConnectorType } from "@/contracts/sources";
import { normalizeAtlassianSourceLink } from "@/shared/connectors/providers/confluence/url";
import type { KbCatalogRow } from "@/shared/sources/source-catalog-types";
import {
  compareKbCatalogRowsByIndexStatus,
  formatKbCatalogRowTitle,
  formatKbTableDate,
  getKbItemIndexStatus,
  KB_SOURCE_FILTER_OPTIONS,
} from "@/shared/sources/source-item-status";
import { cn } from "@/shared/utils";

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    code?: string;
    error?: string;
  } | null;
  if (payload?.code === "REAUTH_REQUIRED") {
    window.location.assign("/login?reason=reauth");
    return "Re-authentication required.";
  }
  return payload?.error ?? "Request failed.";
}

function indexedByLabel(row: KbCatalogRow, viewerUserId: string) {
  if (row.status === "not_indexed") {
    return "—";
  }
  if (row.createdByUserId === viewerUserId) {
    return "You";
  }
  const name = row.indexedByName?.trim();
  if (name) {
    return name;
  }
  const email = row.indexedByEmail?.trim();
  if (email) {
    return email.split("@")[0] ?? email;
  }
  return "—";
}

function sourceLabel(sourceType: SourceConnectorType) {
  return (
    KB_SOURCE_FILTER_OPTIONS.find((option) => option.value === sourceType)
      ?.label ?? sourceType
  );
}

const CONNECTOR_CATALOG_SOURCE_TYPES = new Set<SourceConnectorType>([
  "drive",
  "confluence",
  "notion",
  "sharepoint",
  "slack",
]);

function rowCanBeIndexed(row: KbCatalogRow) {
  return row.status === "not_indexed" || row.status === "update_available";
}

function rowCanBeReindexed(row: KbCatalogRow) {
  return (
    CONNECTOR_CATALOG_SOURCE_TYPES.has(row.sourceType) &&
    row.status === "indexed"
  );
}

function rowSupportsIndexAction(row: KbCatalogRow) {
  return rowCanBeIndexed(row) || rowCanBeReindexed(row);
}

function rowCanBeRemoved(row: KbCatalogRow) {
  if (row.sourceType === "slack") {
    return row.status === "indexed" || row.status === "update_available";
  }
  return Boolean(row.kbItemId);
}

function countNotionRows(rowsToIndex: KbCatalogRow[]) {
  return rowsToIndex.filter((row) => row.sourceType === "notion").length;
}

function openKbCatalogRowLink(link: string) {
  window.open(
    normalizeAtlassianSourceLink(link),
    "_blank",
    "noopener,noreferrer"
  );
}

function stopRowNavigation(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

const KB_CATALOG_PAGE_SIZE = 8;

export function KbCatalogTable({
  tenantSlug,
  scope,
  knowledgeBaseId,
  viewerUserId,
  viewerEmail,
  notionShareMembers,
  canPublishToWorkspace,
  canWrite,
  refreshToken,
  onIndexed,
  knowledgeBaseToolbarActions,
}: {
  tenantSlug: string;
  scope: "personal" | "team";
  knowledgeBaseId?: string;
  viewerUserId: string;
  viewerEmail: string;
  notionShareMembers: NotionShareMemberOption[];
  canPublishToWorkspace: boolean;
  canWrite: boolean;
  refreshToken?: number;
  onIndexed: () => void;
  knowledgeBaseToolbarActions?: ReactNode;
}) {
  const [rows, setRows] = useState<KbCatalogRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSources, setSelectedSources] = useState<
    Set<SourceConnectorType>
  >(() => new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isRemovingSelected, setIsRemovingSelected] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [indexingRowKey, setIndexingRowKey] = useState<string | null>(null);
  const [pendingIndexRows, setPendingIndexRows] = useState<
    KbCatalogRow[] | null
  >(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [
    isKnowledgeBaseStaleCheckPending,
    setIsKnowledgeBaseStaleCheckPending,
  ] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadKnowledgeBaseStaleStatuses = useCallback(async () => {
    if (!knowledgeBaseId) {
      return;
    }
    try {
      const response = await fetch(
        `${process.env.KIMIRO_BASE_PATH ?? ""}/api/knowledge-bases/${tenantSlug}/${knowledgeBaseId}/catalog/stale?_ts=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        updates: Array<{
          kbItemId: string;
          status: KbCatalogRow["status"];
          modifiedAt: string | null;
          driveMimeType?: string | null;
        }>;
      };
      const updateByItemId = new Map(
        payload.updates.map((update) => [update.kbItemId, update])
      );
      setRows((current) =>
        current.map((row) => {
          if (!row.kbItemId) {
            return row;
          }
          const update = updateByItemId.get(row.kbItemId);
          if (!update) {
            return row;
          }
          return {
            ...row,
            driveMimeType: update.driveMimeType ?? row.driveMimeType,
            modifiedAt: update.modifiedAt ?? row.modifiedAt,
            status: update.status,
          };
        })
      );
    } catch {
      // Background stale check; ignore failures.
    } finally {
      setIsKnowledgeBaseStaleCheckPending(false);
    }
  }, [knowledgeBaseId, tenantSlug]);

  const loadCatalog = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("_ts", String(Date.now()));
        const catalogPath = knowledgeBaseId
          ? `/api/knowledge-bases/${tenantSlug}/${knowledgeBaseId}/catalog`
          : `/api/sources/${tenantSlug}/catalog`;
        const response = await fetch(`${catalogPath}?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as { rows: KbCatalogRow[] };
        setRows(payload.rows);
        setSelectedKeys(new Set());
        if (knowledgeBaseId) {
          const hasConnectorRows = payload.rows.some((row) =>
            CONNECTOR_CATALOG_SOURCE_TYPES.has(row.sourceType)
          );
          if (hasConnectorRows) {
            setIsKnowledgeBaseStaleCheckPending(true);
            loadKnowledgeBaseStaleStatuses().catch(() => undefined);
          } else {
            setIsKnowledgeBaseStaleCheckPending(false);
          }
        } else {
          setIsKnowledgeBaseStaleCheckPending(false);
        }
      } catch {
        setError("Failed to load knowledge catalog.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [tenantSlug, knowledgeBaseId, loadKnowledgeBaseStaleStatuses]
  );

  useEffect(() => {
    loadCatalog("initial").catch(() => undefined);
  }, [loadCatalog]);

  useEffect(() => {
    if (refreshToken === 0) {
      return;
    }
    loadCatalog("refresh").catch(() => undefined);
  }, [refreshToken, loadCatalog]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = debouncedSearch.toLowerCase();
    const filtered = rows.filter((row) => {
      if (
        normalizedSearch &&
        !row.title.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }
      if (selectedSources.size > 0 && !selectedSources.has(row.sourceType)) {
        return false;
      }
      return true;
    });
    return [...filtered].sort(compareKbCatalogRowsByIndexStatus);
  }, [rows, selectedSources, debouncedSearch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / KB_CATALOG_PAGE_SIZE)
  );
  const showPagination = filteredRows.length > KB_CATALOG_PAGE_SIZE;

  const paginatedRows = useMemo(() => {
    if (!showPagination) {
      return filteredRows;
    }
    const start = (page - 1) * KB_CATALOG_PAGE_SIZE;
    return filteredRows.slice(start, start + KB_CATALOG_PAGE_SIZE);
  }, [filteredRows, page, showPagination]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedRows = filteredRows.filter((row) =>
    selectedKeys.has(row.rowKey)
  );
  const selectedIndexableRows = selectedRows.filter(rowSupportsIndexAction);
  const selectedRemovableRows = selectedRows.filter(rowCanBeRemoved);

  function toggleRow(rowKey: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }

  async function onRemove(row: KbCatalogRow) {
    if (knowledgeBaseId) {
      if (!row.kbItemId) {
        return;
      }
      setRemovingId(row.kbItemId);
      setError(null);
      const response = await fetch(
        `/api/knowledge-bases/${tenantSlug}/${knowledgeBaseId}/sources?sourceItemId=${encodeURIComponent(row.kbItemId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        setError(await readApiError(response));
        setRemovingId(null);
        return;
      }
      setRemovingId(null);
      await loadCatalog("refresh");
      onIndexed();
      return;
    }

    if (row.sourceType === "slack") {
      setRemovingId(row.externalRef);
      setError(null);
      const response = await fetch(
        `/api/sources/${tenantSlug}/${scope}/index-slack`,
        {
          body: JSON.stringify({ channelIds: [row.externalRef] }),
          headers: { "content-type": "application/json" },
          method: "DELETE",
        }
      );
      if (!response.ok) {
        setError(await readApiError(response));
        setRemovingId(null);
        return;
      }
      setRemovingId(null);
      await loadCatalog("refresh");
      onIndexed();
      return;
    }

    if (!row.kbItemId) {
      return;
    }
    setRemovingId(row.kbItemId);
    setError(null);
    const response = await fetch(
      `/api/sources/${tenantSlug}/${scope}?id=${encodeURIComponent(row.kbItemId)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      setError(await readApiError(response));
      setRemovingId(null);
      return;
    }
    setRemovingId(null);
    await loadCatalog("refresh");
    onIndexed();
  }

  async function indexCatalogRows(
    rowsToIndex: KbCatalogRow[],
    notionShare?: NotionIndexShareSettings
  ) {
    if (rowsToIndex.length === 0) {
      return;
    }

    const driveIds = rowsToIndex
      .filter((row) => row.sourceType === "drive")
      .map((row) => row.externalRef);
    const confluenceIds = rowsToIndex
      .filter((row) => row.sourceType === "confluence")
      .map((row) => row.externalRef);
    const notionPageIds = rowsToIndex
      .filter(
        (row) => row.sourceType === "notion" && row.notionKind !== "database"
      )
      .map((row) => row.externalRef);
    const notionDatabaseIds = rowsToIndex
      .filter(
        (row) => row.sourceType === "notion" && row.notionKind === "database"
      )
      .map((row) => row.externalRef);
    const sharePointRefs = rowsToIndex
      .filter((row) => row.sourceType === "sharepoint")
      .map((row) => row.externalRef);
    const slackChannelIds = rowsToIndex
      .filter((row) => row.sourceType === "slack")
      .map((row) => row.externalRef);

    const requests: Promise<Response>[] = [];
    const base = knowledgeBaseId
      ? `/api/knowledge-bases/${tenantSlug}/${knowledgeBaseId}`
      : `/api/sources/${tenantSlug}/${scope}`;

    if (knowledgeBaseId) {
      for (let index = 0; index < driveIds.length; index += 10) {
        requests.push(
          fetch(`${base}/drive`, {
            body: JSON.stringify({
              fileIds: driveIds.slice(index, index + 10),
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );
      }
      if (
        driveIds.length === 0 &&
        confluenceIds.length === 0 &&
        notionPageIds.length === 0 &&
        notionDatabaseIds.length === 0 &&
        sharePointRefs.length === 0 &&
        slackChannelIds.length === 0
      ) {
        return;
      }
      if (
        confluenceIds.length > 0 ||
        notionPageIds.length > 0 ||
        notionDatabaseIds.length > 0 ||
        sharePointRefs.length > 0 ||
        slackChannelIds.length > 0
      ) {
        setError(
          "Only Google Drive indexing is supported in knowledge bases for now."
        );
        return;
      }
    } else {
      for (let index = 0; index < driveIds.length; index += 10) {
        requests.push(
          fetch(`${base}/index-drive`, {
            body: JSON.stringify({
              fileIds: driveIds.slice(index, index + 10),
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );
      }
      for (let index = 0; index < confluenceIds.length; index += 10) {
        requests.push(
          fetch(`${base}/index-confluence`, {
            body: JSON.stringify({
              pageIds: confluenceIds.slice(index, index + 10),
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );
      }
      const notionBodyBase =
        notionShare && notionShare.shareMode !== "indexers"
          ? {
              shareMode: notionShare.shareMode,
              shareWithEmails: notionShare.shareWithEmails,
            }
          : {};

      if (notionPageIds.length > 0) {
        for (let index = 0; index < notionPageIds.length; index += 10) {
          requests.push(
            fetch(`${base}/index-notion`, {
              body: JSON.stringify({
                pageIds: notionPageIds.slice(index, index + 10),
                ...notionBodyBase,
              }),
              headers: { "content-type": "application/json" },
              method: "POST",
            })
          );
        }
      }
      if (notionDatabaseIds.length > 0) {
        for (let index = 0; index < notionDatabaseIds.length; index += 3) {
          requests.push(
            fetch(`${base}/index-notion`, {
              body: JSON.stringify({
                databaseIds: notionDatabaseIds.slice(index, index + 3),
                ...notionBodyBase,
              }),
              headers: { "content-type": "application/json" },
              method: "POST",
            })
          );
        }
      }
      for (let index = 0; index < sharePointRefs.length; index += 10) {
        requests.push(
          fetch(`${base}/index-sharepoint`, {
            body: JSON.stringify({
              pageRefs: sharePointRefs.slice(index, index + 10),
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );
      }
      for (let index = 0; index < slackChannelIds.length; index += 10) {
        requests.push(
          fetch(`${base}/index-slack`, {
            body: JSON.stringify({
              channelIds: slackChannelIds.slice(index, index + 10),
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );
      }
    }

    const responses = await Promise.all(requests);
    const failed = (
      await Promise.all(
        responses.map(async (response) =>
          response.ok ? null : await readApiError(response)
        )
      )
    ).filter(Boolean);

    if (failed.length > 0) {
      setError(failed[0] ?? "Index failed.");
    }
    await loadCatalog("refresh");
    onIndexed();
  }

  async function runIndex(
    rowsToIndex: KbCatalogRow[],
    notionShare?: NotionIndexShareSettings
  ) {
    setError(null);
    await indexCatalogRows(rowsToIndex, notionShare);
  }

  function requestIndex(rowsToIndex: KbCatalogRow[]) {
    if (rowsToIndex.length === 0) {
      return;
    }
    if (!knowledgeBaseId && countNotionRows(rowsToIndex) > 0) {
      setPendingIndexRows(rowsToIndex);
      setShareDialogOpen(true);
      return;
    }
    runIndex(rowsToIndex).catch(() => undefined);
  }

  async function onShareDialogConfirm(notionShare: NotionIndexShareSettings) {
    if (!pendingIndexRows) {
      return;
    }
    setIsIndexing(true);
    setError(null);
    try {
      await runIndex(pendingIndexRows, notionShare);
      setShareDialogOpen(false);
      setPendingIndexRows(null);
    } finally {
      setIsIndexing(false);
      setIndexingRowKey(null);
    }
  }

  async function onIndexRow(row: KbCatalogRow) {
    setIndexingRowKey(row.rowKey);
    if (countNotionRows([row]) > 0) {
      requestIndex([row]);
      return;
    }
    try {
      await runIndex([row]);
    } finally {
      setIndexingRowKey(null);
    }
  }

  async function onIndexSelected() {
    if (selectedIndexableRows.length === 0) {
      return;
    }
    if (countNotionRows(selectedIndexableRows) > 0) {
      requestIndex(selectedIndexableRows);
      return;
    }
    setIsIndexing(true);
    setError(null);
    try {
      await runIndex(selectedIndexableRows);
    } finally {
      setIsIndexing(false);
    }
  }

  async function onRemoveSelected() {
    if (selectedRemovableRows.length === 0) {
      return;
    }
    setIsRemovingSelected(true);
    setError(null);

    if (knowledgeBaseId) {
      const kbItemIds = selectedRemovableRows
        .filter((row) => row.kbItemId)
        .map((row) => row.kbItemId as string);
      const results: Array<string | null> = [];
      for (const kbItemId of kbItemIds) {
        const response = await fetch(
          `/api/knowledge-bases/${tenantSlug}/${knowledgeBaseId}/sources?sourceItemId=${encodeURIComponent(kbItemId)}`,
          { method: "DELETE" }
        );
        results.push(response.ok ? null : await readApiError(response));
      }
      const failed = results.filter(Boolean);
      if (failed.length > 0) {
        setError(failed[0] ?? "Remove failed.");
      }
      setIsRemovingSelected(false);
      await loadCatalog("refresh");
      onIndexed();
      return;
    }

    const slackIds = selectedRemovableRows
      .filter((row) => row.sourceType === "slack")
      .map((row) => row.externalRef);
    const kbItemIds = selectedRemovableRows
      .filter((row) => row.sourceType !== "slack" && row.kbItemId)
      .map((row) => row.kbItemId as string);

    const results: Array<string | null> = [];
    if (slackIds.length > 0) {
      for (let index = 0; index < slackIds.length; index += 10) {
        const response = await fetch(
          `/api/sources/${tenantSlug}/${scope}/index-slack`,
          {
            body: JSON.stringify({
              channelIds: slackIds.slice(index, index + 10),
            }),
            headers: { "content-type": "application/json" },
            method: "DELETE",
          }
        );
        results.push(response.ok ? null : await readApiError(response));
      }
    }
    for (const kbItemId of kbItemIds) {
      const response = await fetch(
        `/api/sources/${tenantSlug}/${scope}?id=${encodeURIComponent(kbItemId)}`,
        { method: "DELETE" }
      );
      results.push(response.ok ? null : await readApiError(response));
    }
    const failed = results.filter(Boolean);
    if (failed.length > 0) {
      setError(failed[0] ?? "Remove failed.");
    }
    setIsRemovingSelected(false);
    await loadCatalog("refresh");
    onIndexed();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          className="h-8 w-full max-w-56 shrink-0 rounded-lg bg-transparent sm:w-56 sm:max-w-none"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by name..."
          value={searchQuery}
        />
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto [&_button]:cursor-pointer">
          <TenantUsersFacetedFilter
            onSelectedValuesChange={(values) => {
              setSelectedSources(values);
              setPage(1);
            }}
            options={KB_SOURCE_FILTER_OPTIONS}
            selectedValues={selectedSources}
            title="Source"
          />
          {knowledgeBaseId ? null : (
            <Button
              disabled={isLoading || isRefreshing}
              onClick={() => {
                loadCatalog("refresh").catch(() => undefined);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCwIcon className={cn(isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          )}
          {knowledgeBaseId && knowledgeBaseToolbarActions
            ? knowledgeBaseToolbarActions
            : null}
          {canWrite ? (
            <>
              <Button
                disabled={isIndexing || selectedIndexableRows.length === 0}
                onClick={() => {
                  onIndexSelected().catch(() => undefined);
                }}
                size="sm"
                type="button"
              >
                {isIndexing
                  ? "Indexing…"
                  : `Index${selectedIndexableRows.length > 0 ? ` (${selectedIndexableRows.length})` : ""}`}
              </Button>
              <Button
                disabled={
                  isRemovingSelected || selectedRemovableRows.length === 0
                }
                onClick={() => {
                  onRemoveSelected().catch(() => undefined);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {isRemovingSelected
                  ? "Removing…"
                  : `Remove${selectedRemovableRows.length > 0 ? ` (${selectedRemovableRows.length})` : ""}`}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {isLoading && rows.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 px-4 py-12">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-muted-foreground text-sm">
          {rows.length === 0
            ? "No files found from connected sources."
            : debouncedSearch
              ? "No documents match your search."
              : "No documents match your filters."}
        </p>
      ) : (
        <Table className="table-fixed [&_button]:cursor-pointer **:data-[slot=dropdown-menu-item]:cursor-pointer">
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              {canWrite ? (
                <TableHead className="w-10 px-0 font-normal text-muted-foreground">
                  <span className="sr-only">Select</span>
                </TableHead>
              ) : null}
              <TableHead className="w-[26%] px-0 font-normal text-muted-foreground">
                File Name
              </TableHead>
              <TableHead className="font-normal text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="font-normal text-muted-foreground">
                {knowledgeBaseId ? "Source" : "Indexed by"}
              </TableHead>
              <TableHead className="font-normal text-muted-foreground">
                {knowledgeBaseId ? "Indexed by" : "Last indexed"}
              </TableHead>
              <TableHead className="w-24 pr-0 font-normal text-muted-foreground">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row) => {
              const displayTitle = formatKbCatalogRowTitle(row);
              const statusPending =
                Boolean(knowledgeBaseId) &&
                isKnowledgeBaseStaleCheckPending &&
                CONNECTOR_CATALOG_SOURCE_TYPES.has(row.sourceType);
              const status = statusPending
                ? null
                : getKbItemIndexStatus({
                    lastIndexedAt: row.lastIndexedAt,
                    sourceType: row.sourceType,
                    sourceUpdatedAt: row.modifiedAt,
                    status: row.status,
                  });
              const canRemove = canWrite && rowCanBeRemoved(row);
              const canIndex = canWrite && rowCanBeIndexed(row);
              const canReindex = canWrite && rowCanBeReindexed(row);
              const showRowMenu = canRemove || canIndex || canReindex;
              const isRemoving =
                removingId !== null &&
                (removingId === row.kbItemId || removingId === row.externalRef);
              const isIndexingRow = indexingRowKey === row.rowKey;

              return (
                <TableRow
                  aria-label={
                    row.link ? `Open ${displayTitle} in source` : undefined
                  }
                  className={cn(
                    "border-border/40 hover:bg-muted/20",
                    row.link && "cursor-pointer"
                  )}
                  key={row.rowKey}
                  onClick={() => {
                    if (row.link) {
                      openKbCatalogRowLink(row.link);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!row.link) {
                      return;
                    }
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }
                    const target = event.target;
                    if (
                      target instanceof HTMLElement &&
                      target.closest("button, input")
                    ) {
                      return;
                    }
                    event.preventDefault();
                    openKbCatalogRowLink(row.link);
                  }}
                  role={row.link ? "link" : undefined}
                  tabIndex={row.link ? 0 : undefined}
                >
                  {canWrite ? (
                    <TableCell
                      className="px-0 py-2.5"
                      onClick={stopRowNavigation}
                    >
                      <input
                        aria-label={`Select ${displayTitle}`}
                        checked={selectedKeys.has(row.rowKey)}
                        onChange={() => toggleRow(row.rowKey)}
                        type="checkbox"
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="max-w-0 px-0 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="inline-flex shrink-0 items-center"
                        title={sourceLabel(row.sourceType)}
                      >
                        <KbSourceIcon
                          className="size-5 text-muted-foreground"
                          sourceType={row.sourceType}
                        />
                        <span className="sr-only">
                          {sourceLabel(row.sourceType)}
                        </span>
                      </span>
                      <span
                        className="min-w-0 truncate font-medium text-sm"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    {statusPending || !status ? (
                      <span className="inline-flex h-6 w-23 animate-pulse rounded-lg bg-muted/50">
                        <span className="sr-only">Checking file status</span>
                      </span>
                    ) : (
                      <KbStatusPill status={status} />
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 text-muted-foreground text-sm">
                    {knowledgeBaseId ? (
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <KbSourceIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          sourceType={row.sourceType}
                        />
                        <span>{sourceLabel(row.sourceType)}</span>
                      </span>
                    ) : (
                      indexedByLabel(row, viewerUserId)
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 text-muted-foreground text-sm">
                    {knowledgeBaseId
                      ? indexedByLabel(row, viewerUserId)
                      : formatKbTableDate(row.lastIndexedAt)}
                  </TableCell>
                  <TableCell
                    className="py-2.5 pr-0"
                    onClick={stopRowNavigation}
                  >
                    <div className="flex items-center justify-end gap-0.5">
                      <KbCatalogRowDetailsPopover
                        row={row}
                        viewerUserId={viewerUserId}
                      />
                      {showRowMenu ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="cursor-pointer"
                              disabled={isRemoving || isIndexingRow}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              {isRemoving || isIndexingRow ? (
                                <Loader2Icon className="size-4 animate-spin" />
                              ) : (
                                <MoreHorizontal />
                              )}
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-auto min-w-0 **:data-[slot=dropdown-menu-item]:cursor-pointer"
                          >
                            {canIndex || canReindex ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  onIndexRow(row).catch(() => undefined);
                                }}
                              >
                                <RefreshCwIcon />
                                {canReindex ? "Re-index" : "Index"}
                              </DropdownMenuItem>
                            ) : null}
                            {canRemove ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  onRemove(row).catch(() => undefined);
                                }}
                                variant="destructive"
                              >
                                <TrashIcon />
                                Remove
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {showPagination ? (
        <TenantUsersPagination
          currentPage={page}
          onPageChange={setPage}
          totalPages={totalPages}
        />
      ) : null}

      <NotionIndexShareDialog
        canPublishToWorkspace={canPublishToWorkspace}
        isIndexing={isIndexing}
        members={notionShareMembers}
        notionCount={pendingIndexRows ? countNotionRows(pendingIndexRows) : 0}
        onConfirm={(settings) => {
          onShareDialogConfirm(settings).catch(() => undefined);
        }}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            setPendingIndexRows(null);
            setIndexingRowKey(null);
          }
        }}
        open={shareDialogOpen}
        otherCount={
          pendingIndexRows
            ? pendingIndexRows.length - countNotionRows(pendingIndexRows)
            : 0
        }
        viewerEmail={viewerEmail}
      />
    </div>
  );
}
