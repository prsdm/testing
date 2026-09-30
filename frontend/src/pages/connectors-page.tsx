import { LayoutGridIcon } from "lucide-react";
import useSWR from "swr";
import { TenantConnectorsPanel } from "@/components/connectors/tenant-connectors-panel";
import { useTenant } from "@/components/providers/tenant-provider";
import {
  WorkspacePageHeader,
  WorkspacePageMain,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";
import type { ConnectorPanelItem } from "@/shared/connectors/connectors-panel-types";

type ConnectorsBootstrap = {
  companyName: string;
  tenantSlug: string;
  items: ConnectorPanelItem[];
};

async function fetchConnectorsBootstrap(
  tenantSlug: string
): Promise<ConnectorsBootstrap> {
  const response = await fetch(`/api/connectors/${tenantSlug}/bootstrap`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to load connectors (${response.status})`);
  }
  return response.json() as Promise<ConnectorsBootstrap>;
}

export function ConnectorsPage() {
  const { tenantSlug } = useTenant();
  const { data, error, isLoading } = useSWR(
    ["connectors-bootstrap", tenantSlug],
    () => fetchConnectorsBootstrap(tenantSlug)
  );

  if (isLoading) {
    return <WorkspacePageMain />;
  }

  if (error || !data) {
    return (
      <WorkspacePageMain>
        <p className="text-muted-foreground text-sm">
          Unable to load connectors.
        </p>
      </WorkspacePageMain>
    );
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description={
          <>
            Connect personal accounts for Google Workspace, Confluence, Notion,
            SharePoint, Slack, and Jira in {data.companyName}.
          </>
        }
        icon={<LayoutGridIcon className={workspacePageHeaderIconClassName} />}
        title="Connectors"
      />

      <TenantConnectorsPanel items={data.items} tenantSlug={data.tenantSlug} />
    </WorkspacePageMain>
  );
}
