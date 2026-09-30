"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfluenceConnectorCard } from "@/components/connectors/confluence-connector";
import { GoogleAppConnectorCard } from "@/components/connectors/google-app-connector-card";
import { JiraConnectorCard } from "@/components/connectors/jira-connector";
import { McpConnectorCard } from "@/components/connectors/mcp-connector-card";
import { NotionConnectorCard } from "@/components/connectors/notion-connector";
import { SharePointConnectorCard } from "@/components/connectors/sharepoint-connector";
import { SlackConnectorCard } from "@/components/connectors/slack-connector";
import { WorkSkillCard } from "@/components/connectors/work-skill-card";
import { Input } from "@/components/ui/input";
import { TenantUsersPagination } from "@/components/users/tenant-users-pagination";

export type { ConnectorPanelItem } from "@/shared/connectors/connectors-panel-types";

import type { ConnectorPanelItem } from "@/shared/connectors/connectors-panel-types";

export const CONNECTORS_PAGE_SIZE = 8;

function isBuiltInTool(item: ConnectorPanelItem) {
  return item.kind === "work-skill";
}

function isMcpConnector(item: ConnectorPanelItem) {
  return item.kind === "mcp";
}

function splitConnectorItems(items: ConnectorPanelItem[]) {
  const builtInTools: ConnectorPanelItem[] = [];
  const connectedAccounts: ConnectorPanelItem[] = [];
  const mcpConnectors: ConnectorPanelItem[] = [];

  for (const item of items) {
    if (isBuiltInTool(item)) {
      builtInTools.push(item);
    } else if (isMcpConnector(item)) {
      mcpConnectors.push(item);
    } else {
      connectedAccounts.push(item);
    }
  }

  return { builtInTools, connectedAccounts, mcpConnectors };
}

function ConnectorGridSection({
  title,
  items,
  tenantSlug,
}: {
  title: string;
  items: ConnectorPanelItem[];
  tenantSlug: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-muted-foreground text-xs">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <ConnectorPanelCard
            item={item}
            key={item.id}
            tenantSlug={tenantSlug}
          />
        ))}
      </div>
    </section>
  );
}

function ConnectorPanelCard({
  item,
  tenantSlug,
}: {
  item: ConnectorPanelItem;
  tenantSlug: string;
}) {
  switch (item.kind) {
    case "google-app":
      return (
        <GoogleAppConnectorCard
          initialStatus={item.initialStatus}
          tenantSlug={tenantSlug}
        />
      );
    case "confluence":
      return (
        <ConfluenceConnectorCard
          description={item.description}
          initialStatus={item.initialStatus}
          tenantSlug={tenantSlug}
        />
      );
    case "notion":
      return (
        <NotionConnectorCard
          description={item.description}
          initialStatus={item.initialStatus}
          tenantSlug={tenantSlug}
        />
      );
    case "sharepoint":
      return (
        <SharePointConnectorCard
          description={item.description}
          initialStatus={item.initialStatus}
          tenantSlug={tenantSlug}
        />
      );
    case "slack":
      return (
        <SlackConnectorCard
          description={item.description}
          initialStatus={item.initialStatus}
          tenantSlug={tenantSlug}
        />
      );
    case "jira":
      return (
        <JiraConnectorCard
          description={item.description}
          initialStatus={item.initialStatus}
          tenantSlug={tenantSlug}
        />
      );
    case "mcp":
      return (
        <McpConnectorCard
          description={item.description}
          initialStatus={item.initialStatus}
          name={item.name}
          tenantSlug={tenantSlug}
        />
      );
    case "work-skill":
      return (
        <WorkSkillCard
          description={item.description}
          name={item.name}
          skillId={item.skillId}
        />
      );
    default:
      return null;
  }
}

export function TenantConnectorsPanel({
  items,
  tenantSlug,
}: {
  items: ConnectorPanelItem[];
  tenantSlug: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredItems = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized)
    );
  }, [items, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / CONNECTORS_PAGE_SIZE)
  );
  const showPagination = filteredItems.length > CONNECTORS_PAGE_SIZE;

  const paginatedItems = useMemo(() => {
    if (!showPagination) {
      return filteredItems;
    }

    const start = (page - 1) * CONNECTORS_PAGE_SIZE;
    return filteredItems.slice(start, start + CONNECTORS_PAGE_SIZE);
  }, [filteredItems, page, showPagination]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const { builtInTools, connectedAccounts, mcpConnectors } = useMemo(
    () => splitConnectorItems(paginatedItems),
    [paginatedItems]
  );

  const showBuiltInSection = builtInTools.length > 0;
  const showConnectedSection = connectedAccounts.length > 0;
  const showMcpSection = mcpConnectors.length > 0;

  return (
    <div className="flex flex-col gap-5 [&_a]:cursor-pointer [&_button]:cursor-pointer">
      <div className="relative w-full sm:max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 rounded-lg bg-transparent pl-9"
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search by name..."
          value={searchQuery}
        />
      </div>

      {filteredItems.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          {searchQuery.trim()
            ? `No connectors match "${searchQuery.trim()}"`
            : "No connectors available."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {showBuiltInSection ? (
            <ConnectorGridSection
              items={builtInTools}
              tenantSlug={tenantSlug}
              title="Built-in tools"
            />
          ) : null}
          {showConnectedSection ? (
            <ConnectorGridSection
              items={connectedAccounts}
              tenantSlug={tenantSlug}
              title="Connected accounts"
            />
          ) : null}
          {showMcpSection ? (
            <ConnectorGridSection
              items={mcpConnectors}
              tenantSlug={tenantSlug}
              title="MCP connectors"
            />
          ) : null}
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
  );
}
