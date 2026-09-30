import { FolderKanbanIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import { KnowledgeBaseDetailPanel } from "@/components/knowledge-bases/knowledge-bases-panel";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { useTenant } from "@/components/providers/tenant-provider";
import {
  WorkspacePageHeader,
  WorkspacePageMain,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";
import type { KnowledgeBaseSummary } from "@/contracts/knowledge-bases";
import { knowledgeBasesApiBase } from "@/lib/knowledge-bases/knowledge-base-api-client";

export function KnowledgeBaseDetailPage() {
  const { knowledgeBaseId } = useParams<{ knowledgeBaseId: string }>();
  const { tenantSlug } = useTenant();
  const user = useSessionUser();

  const apiUrl =
    knowledgeBaseId &&
    `${knowledgeBasesApiBase(tenantSlug)}/${knowledgeBaseId}`;

  const { data, error, isLoading } = useSWR(
    apiUrl ? ["knowledge-base", apiUrl] : null,
    async ([, url]: [string, string]) => {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Knowledge base not found");
      }
      const payload = (await response.json()) as {
        knowledgeBase: KnowledgeBaseSummary;
      };
      return payload.knowledgeBase;
    }
  );

  if (!knowledgeBaseId || !user?.email) {
    return null;
  }

  if (isLoading) {
    return (
      <WorkspacePageMain>
        <WorkspacePageHeader
          description="Loading…"
          icon={
            <FolderKanbanIcon className={workspacePageHeaderIconClassName} />
          }
          title="Knowledge base"
        />
      </WorkspacePageMain>
    );
  }

  if (error || !data) {
    return (
      <WorkspacePageMain>
        <p className="text-muted-foreground text-sm">
          Knowledge base not found.
        </p>
      </WorkspacePageMain>
    );
  }

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description={
          data.description?.trim() ??
          "Browse files from Drive and index what you need — same as Sources, scoped to this knowledge base folder."
        }
        icon={<FolderKanbanIcon className={workspacePageHeaderIconClassName} />}
        title={data.name}
      />
      <KnowledgeBaseDetailPanel
        knowledgeBaseId={knowledgeBaseId}
        tenantSlug={tenantSlug}
        viewerEmail={user.email}
        viewerUserId={user.id}
      />
    </WorkspacePageMain>
  );
}
