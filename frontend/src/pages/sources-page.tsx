import { BookTextIcon } from "lucide-react";
import useSWR from "swr";
import { useTenant } from "@/components/providers/tenant-provider";
import { KbItemsPanel } from "@/components/sources/source-items-panel";
import {
  WorkspacePageHeader,
  WorkspacePageMain,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";
import type { NotionShareMemberOption } from "@/contracts/sources";

type SourcesBootstrap = {
  tenantSlug: string;
  viewerUserId: string;
  viewerEmail: string;
  canPublishToWorkspace: boolean;
  notionShareMembers: NotionShareMemberOption[];
};

async function fetchSourcesBootstrap(
  tenantSlug: string
): Promise<SourcesBootstrap> {
  const response = await fetch(`/api/sources/${tenantSlug}/bootstrap`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to load sources (${response.status})`);
  }
  return response.json() as Promise<SourcesBootstrap>;
}

export function SourcesPage() {
  const { tenantSlug } = useTenant();
  const { data, error, isLoading } = useSWR(
    ["sources-bootstrap", tenantSlug],
    () => fetchSourcesBootstrap(tenantSlug)
  );

  if (isLoading) {
    return <WorkspacePageMain />;
  }

  if (error || !data) {
    return (
      <WorkspacePageMain>
        <p className="text-muted-foreground text-sm">Unable to load sources.</p>
      </WorkspacePageMain>
    );
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Browse files from Drive, Notion, Confluence and SharePoint in one table and index what you need."
        icon={<BookTextIcon className={workspacePageHeaderIconClassName} />}
        title="Sources"
      />

      <KbItemsPanel
        canPublishToWorkspace={data.canPublishToWorkspace}
        canWrite
        notionShareMembers={data.notionShareMembers}
        scope="personal"
        tenantSlug={data.tenantSlug}
        viewerEmail={data.viewerEmail}
        viewerUserId={data.viewerUserId}
      />
    </WorkspacePageMain>
  );
}
