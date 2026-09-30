import { FolderKanbanIcon } from "lucide-react";
import { KnowledgeBasesPanel } from "@/components/knowledge-bases/knowledge-bases-panel";
import { useTenant } from "@/components/providers/tenant-provider";
import {
  WorkspacePageHeader,
  WorkspacePageMain,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";

export function KnowledgeBasesPage() {
  const { tenantSlug } = useTenant();

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Curate files for focused work. Upload documents and search within a knowledge base scope."
        icon={<FolderKanbanIcon className={workspacePageHeaderIconClassName} />}
        title="Knowledge base"
      />
      <KnowledgeBasesPanel tenantSlug={tenantSlug} />
    </WorkspacePageMain>
  );
}
