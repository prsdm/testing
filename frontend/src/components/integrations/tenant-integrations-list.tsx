"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminListChevronButton } from "@/components/admin/admin-list-chevron-button";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import {
  type ConnectorProvider,
  ConnectorProviderIcon,
} from "@/components/connectors/connector-provider-icon";
import {
  IntegrationStatusChip,
  NotConfiguredStatusChip,
} from "@/components/integrations/integration-status-chip";
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
import { TenantUsersPagination } from "@/components/users/tenant-users-pagination";
import { getIntegrationCatalogEntry } from "@/shared/integrations/integration-catalog";
import { cn } from "@/shared/utils";

const INTEGRATIONS_PAGE_SIZE = 6;

export type IntegrationListRow = {
  key: string;
  name: string;
  provider: ConnectorProvider;
  isEnabled: boolean;
  connectionsCount: number;
};

function IntegrationRow({
  integration,
  href,
}: {
  integration: IntegrationListRow;
  href: string;
}) {
  const catalog = getIntegrationCatalogEntry(integration.key);
  const description = catalog?.description ?? "";

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <AdminListItemLogoFrame>
          <ConnectorProviderIcon
            className="size-full max-h-6 max-w-6 shrink-0 object-contain"
            provider={integration.provider}
          />
        </AdminListItemLogoFrame>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{integration.name}</span>
            {integration.isEnabled ? (
              <IntegrationStatusChip label="Active" />
            ) : (
              <NotConfiguredStatusChip />
            )}
          </span>
          {description ? (
            <span className="block truncate text-[13px] text-muted-foreground leading-snug">
              {description}
            </span>
          ) : null}
        </span>
      </span>

      <AdminListChevronButton
        href={href}
        label={`Open ${integration.name} settings`}
      />
    </div>
  );
}

export function TenantIntegrationsList({
  tenantSlug,
  initialIntegrations,
}: {
  tenantSlug: string;
  initialIntegrations: IntegrationListRow[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [page, setPage] = useState(1);
  const [disableAllOpen, setDisableAllOpen] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  useEffect(() => {
    setIntegrations(initialIntegrations);
  }, [initialIntegrations]);

  const filteredIntegrations = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return integrations;
    }
    return integrations.filter((integration) => {
      const catalog = getIntegrationCatalogEntry(integration.key);
      const haystack = [integration.name, catalog?.description ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [integrations, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredIntegrations.length / INTEGRATIONS_PAGE_SIZE)
  );
  const showPagination = filteredIntegrations.length > INTEGRATIONS_PAGE_SIZE;

  const paginatedIntegrations = useMemo(() => {
    if (!showPagination) {
      return filteredIntegrations;
    }
    const start = (page - 1) * INTEGRATIONS_PAGE_SIZE;
    return filteredIntegrations.slice(start, start + INTEGRATIONS_PAGE_SIZE);
  }, [filteredIntegrations, page, showPagination]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const enabledCount = integrations.filter(
    (integration) => integration.isEnabled
  ).length;

  async function disableAllIntegrations() {
    const enabled = integrations.filter((integration) => integration.isEnabled);
    if (enabled.length === 0) {
      return;
    }

    setIsDisabling(true);
    const results = await Promise.all(
      enabled.map(async (row) => {
        const response = await fetch(
          `/api/integrations/${tenantSlug}/apps/${row.key}`,
          { method: "DELETE" }
        );
        return { ok: response.ok, row };
      })
    );

    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      toast.error("Some integrations could not be removed.");
      setIsDisabling(false);
      return;
    }

    setIntegrations((current) =>
      current.map((integration) =>
        integration.isEnabled
          ? { ...integration, connectionsCount: 0, isEnabled: false }
          : integration
      )
    );
    setDisableAllOpen(false);
    setIsDisabling(false);
    toast.success("All integrations removed.");
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
              placeholder="Search integrations…"
              value={searchQuery}
            />
          </div>
          {enabledCount > 0 ? (
            <Button
              className="cursor-pointer bg-transparent hover:bg-muted/50"
              disabled={isDisabling}
              onClick={() => setDisableAllOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove all
            </Button>
          ) : null}
        </div>

        {filteredIntegrations.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No integrations match your search.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            {paginatedIntegrations.map((integration, index) => (
              <div
                className={cn(index > 0 && "border-border/60 border-t")}
                key={integration.key}
              >
                <IntegrationRow
                  href={`/admin/integrations/${integration.key}`}
                  integration={integration}
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

      <AlertDialog onOpenChange={setDisableAllOpen} open={disableAllOpen}>
        <AlertDialogContent className="[&_button]:cursor-pointer">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all integrations?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every active integration, clears admin setup, and
              disconnects all members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisabling} type="button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDisabling}
              onClick={(event) => {
                event.preventDefault();
                disableAllIntegrations().catch(() => undefined);
              }}
              type="button"
            >
              {isDisabling ? "Removing…" : "Remove all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
