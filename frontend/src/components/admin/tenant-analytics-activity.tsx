"use client";

import { DownloadIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TenantUsersPagination,
  USERS_PAGE_SIZE,
} from "@/components/users/tenant-users-pagination";
import type { SecurityAuditEventRow } from "@/contracts/admin";
import { formatAuditActionLabel } from "@/lib/admin/audit-action-labels";
import { fetchAuditEvents } from "@/lib/admin/audit-events-api";
import { downloadAuditEventsCsv } from "@/lib/admin/export-audit-events-csv";
import {
  AUDIT_EVENT_CATEGORIES,
  type AuditEventCategoryId,
} from "@/shared/admin/audit-event-categories";
import { cn } from "@/shared/utils";

const AUDIT_PAGE_SIZE = USERS_PAGE_SIZE;

function formatAuditTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

export function TenantAnalyticsActivity({
  tenantSlug,
}: {
  tenantSlug: string;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<AuditEventCategoryId>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const offset = (page - 1) * AUDIT_PAGE_SIZE;
  const swrKey = [
    "audit-events",
    tenantSlug,
    debouncedQuery,
    category,
    fromDate,
    toDate,
    page,
  ] as const;

  const { data, error, isLoading } = useSWR(swrKey, () =>
    fetchAuditEvents(tenantSlug, {
      category,
      from: fromDate || undefined,
      limit: AUDIT_PAGE_SIZE,
      offset,
      q: debouncedQuery || undefined,
      to: toDate || undefined,
    })
  );

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const exportFilters = useMemo(
    () => ({
      category,
      from: fromDate || undefined,
      q: debouncedQuery || undefined,
      to: toDate || undefined,
    }),
    [category, debouncedQuery, fromDate, toDate]
  );

  async function handleExport() {
    setIsExporting(true);
    try {
      const batch = await fetchAuditEvents(tenantSlug, {
        ...exportFilters,
        limit: 100,
        offset: 0,
      });
      const filename = `kimiro-audit-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadAuditEventsCsv(batch.events, filename);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 rounded-lg bg-transparent pl-9"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search activity…"
            value={searchInput}
          />
        </div>
        <Select
          onValueChange={(value) => {
            setCategory(value as AuditEventCategoryId);
            setPage(1);
          }}
          value={category}
        >
          <SelectTrigger className="h-8 w-full sm:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {AUDIT_EVENT_CATEGORIES.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 w-full sm:w-[160px]"
          onChange={(event) => {
            setFromDate(event.target.value);
            setPage(1);
          }}
          type="date"
          value={fromDate}
        />
        <Input
          className="h-8 w-full sm:w-[160px]"
          onChange={(event) => {
            setToDate(event.target.value);
            setPage(1);
          }}
          type="date"
          value={toDate}
        />
        <Button
          className="h-8"
          disabled={isExporting || total === 0}
          onClick={() => void handleExport()}
          size="sm"
          type="button"
          variant="outline"
        >
          <DownloadIcon className="size-4" />
          Export CSV
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm">Unable to load activity.</p>
      ) : null}

      {isLoading && events.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          Loading activity…
        </p>
      ) : null}

      {!isLoading && total === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          No activity matches these filters.
        </p>
      ) : null}

      {events.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {events.map((event, index) => (
            <AuditEventRow
              event={event}
              expanded={expandedId === event.id}
              index={index}
              key={event.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === event.id ? null : event.id
                )
              }
            />
          ))}
        </div>
      ) : null}

      {total > AUDIT_PAGE_SIZE ? (
        <TenantUsersPagination
          align="center"
          currentPage={page}
          onPageChange={setPage}
          totalPages={totalPages}
        />
      ) : null}

      <p className="text-[13px] text-muted-foreground">
        Showing {events.length} of {total} events
        {debouncedQuery ? ` matching “${debouncedQuery}”` : ""}. Export includes
        up to 100 rows for the current filters.
      </p>
    </div>
  );
}

function AuditEventRow({
  event,
  index,
  expanded,
  onToggle,
}: {
  event: SecurityAuditEventRow;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const metadataText = formatMetadata(event.metadata);

  return (
    <button
      className={cn(
        "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/30",
        index > 0 && "border-border/60 border-t"
      )}
      onClick={onToggle}
      type="button"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-sm">
          {formatAuditActionLabel(event.action)}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {formatAuditTime(event.createdAt)}
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground">
        {[event.email, event.resource, event.ipAddress]
          .filter(Boolean)
          .join(" · ") || "System"}
      </p>
      {expanded && metadataText ? (
        <pre className="mt-1 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[11px] text-muted-foreground">
          {metadataText}
        </pre>
      ) : null}
      {expanded && !metadataText ? (
        <p className="mt-1 text-[12px] text-muted-foreground/80">
          {event.action}
        </p>
      ) : null}
    </button>
  );
}
